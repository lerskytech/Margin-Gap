import { create } from 'zustand'
import type { ScanResult, RegionKey } from '@/lib/types'
import { scanProduct } from '@/features/scans/scanService'
import { devError } from '@/lib/devLog'
import { makeScanKey } from '@/utils/scanKey'

interface RecentScan {
  scanKey: string // Stable key for deduplication
  latestScanId: string // Most recent scan_id for this key
  query: string
  timestamp: string
  productId: string
  region_key?: string // Region/scope for display
  count: number // Number of scans with this key
  allScanIds: string[] // All scan_ids for this key (for history)
}

interface ScanState {
  currentScan: ScanResult | null
  loading: boolean
  error: string | null
  regionKey: RegionKey
  recentScans: RecentScan[]
  scanCache: Map<string, ScanResult> // Full scan results keyed by scan_id
  scanHistory: ScanResult[] // All scans in chronological order (for chart timeline)
  lastError: Error | null
  setRegionKey: (key: RegionKey) => void
  performScan: (query: string, userId?: string) => Promise<void>
  selectScan: (scanId: string) => void
  clearScan: () => void
  loadRecentScans: () => void
  setActiveScan: (scan: ScanResult | null) => void
  getAllScans: () => ScanResult[]
}

export const useScanStore = create<ScanState>((set, get) => ({
  currentScan: null,
  loading: false,
  error: null,
  regionKey: 'US',
  recentScans: [],
  scanCache: new Map<string, ScanResult>(),
  scanHistory: [], // Full history for chart timeline (max 200)
  lastError: null,
  setRegionKey: (key) => set({ regionKey: key }),
  performScan: async (query, userId) => {
    if (!query || !query.trim()) {
      set({ error: 'Query cannot be empty', loading: false })
      return
    }

    set({ loading: true, error: null, lastError: null })
    try {
      const result = await scanProduct({
        query: query.trim(),
        regionKey: get().regionKey,
        userId,
      })
      
      // Validate result shape
      if (!result || !result.scan_id || !result.query) {
        throw new Error('Invalid scan result received')
      }

      // Ensure aggregates is an array
      if (!Array.isArray(result.aggregates)) {
        devError('Scan result missing aggregates array, defaulting to empty')
        result.aggregates = []
      }

      // Ensure verdict exists
      if (!result.verdict) {
        devError('Scan result missing verdict, creating default')
        result.verdict = {
          status: 'at_market',
          confidence_score: 0,
          fair_value_range: { low: 0, high: 0 },
        }
      }
      
      // Cache the full scan result
      const cache = new Map(get().scanCache)
      cache.set(result.scan_id, result)
      
      // Add to scan history (chronological, max 200, dedupe by scan_id)
      const history = get().scanHistory
      const historyWithoutThis = history.filter(s => s.scan_id !== result.scan_id)
      const newHistory = [result, ...historyWithoutThis].slice(0, 200)
      
      // Group recent scans by stable key (dedupe by query + scope + sources)
      const scanKey = makeScanKey(result)
      const existingRecentScans = get().recentScans
      const existingGroup = existingRecentScans.find(s => s.scanKey === scanKey)
      
      let updatedRecentScans: RecentScan[]
      if (existingGroup) {
        // Update existing group: increment count, update latest scan
        updatedRecentScans = existingRecentScans.map(s => {
          if (s.scanKey === scanKey) {
            return {
              ...s,
              latestScanId: result.scan_id,
              timestamp: result.scanned_at || new Date().toISOString(),
              count: s.count + 1,
              allScanIds: [result.scan_id, ...s.allScanIds.filter(id => id !== result.scan_id)].slice(0, 50), // Keep last 50
            }
          }
          return s
        })
        // Move updated group to front
        const groupIndex = updatedRecentScans.findIndex(s => s.scanKey === scanKey)
        const group = updatedRecentScans.splice(groupIndex, 1)[0]
        updatedRecentScans = [group, ...updatedRecentScans]
      } else {
        // Create new group
        const newGroup: RecentScan = {
          scanKey,
          latestScanId: result.scan_id,
          query: result.query,
          timestamp: result.scanned_at || new Date().toISOString(),
          productId: result.product_id,
          region_key: result.region_key,
          count: 1,
          allScanIds: [result.scan_id],
        }
        updatedRecentScans = [newGroup, ...existingRecentScans].slice(0, 20) // Keep top 20 groups
      }
      
      set({ 
        currentScan: result, 
        loading: false, 
        recentScans: updatedRecentScans, 
        scanCache: cache,
        scanHistory: newHistory,
        error: null 
      })
      
      // Save to localStorage as fallback
      try {
        localStorage.setItem('recent_scans', JSON.stringify(updatedRecentScans))
        // Also cache the full scan result (keep last 20)
        const cacheData = Array.from(cache.entries()).map(([id, scan]) => ({
          id,
          scan,
        }))
        localStorage.setItem('scan_cache_full', JSON.stringify(cacheData.slice(-20)))
        // Save scan history (keep last 200)
        localStorage.setItem('scan_history', JSON.stringify(newHistory.slice(0, 200)))
      } catch (e) {
        devError('Failed to save recent scans to localStorage:', e)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Scan failed')
      const errorMessage = err.message || 'Scan failed'
      devError('Scan error:', err)
      set({ 
        error: errorMessage, 
        loading: false,
        lastError: err,
      })
    }
  },
  selectScan: (scanId: string) => {
    // Load scan from cache without creating a new scan or adding to recent scans
    const cache = get().scanCache
    const cachedScan = cache.get(scanId)
    
    if (cachedScan) {
      // Validate and set the cached scan (DO NOT add to recentScans - just select it)
      const safeScan: ScanResult = {
        ...cachedScan,
        aggregates: Array.isArray(cachedScan.aggregates) ? cachedScan.aggregates : [],
        verdict: cachedScan.verdict || {
          status: 'at_market',
          confidence_score: 0,
          fair_value_range: { low: 0, high: 0 },
        },
        listings: Array.isArray(cachedScan.listings) ? cachedScan.listings : [],
        scanned_at: cachedScan.scanned_at || new Date().toISOString(),
      }
      set({ currentScan: safeScan, error: null, loading: false })
      return
    }
    
    // Try loading from localStorage cache (new format)
    try {
      const cacheData = localStorage.getItem('scan_cache_full')
      if (cacheData) {
        const entries = JSON.parse(cacheData) as Array<{ id: string; scan: ScanResult }>
        const entry = entries.find(e => e.id === scanId)
        if (entry && entry.scan) {
          const safeScan: ScanResult = {
            ...entry.scan,
            aggregates: Array.isArray(entry.scan.aggregates) ? entry.scan.aggregates : [],
            verdict: entry.scan.verdict || {
              status: 'at_market',
              confidence_score: 0,
              fair_value_range: { low: 0, high: 0 },
            },
            listings: Array.isArray(entry.scan.listings) ? entry.scan.listings : [],
            scanned_at: entry.scan.scanned_at || new Date().toISOString(),
          }
          
          // Update cache
          const newCache = new Map(get().scanCache)
          newCache.set(scanId, safeScan)
          set({ currentScan: safeScan, scanCache: newCache, error: null, loading: false })
          return
        }
      }
      
      // Try loading from old localStorage format (scan_cache)
      const oldCache = localStorage.getItem('scan_cache')
      if (oldCache) {
        try {
          const oldEntries = JSON.parse(oldCache) as Array<{
            scanId: string
            product: any
            aggregates: any[]
            verdict: any
            scanned_at: string
          }>
          const oldEntry = oldEntries.find(e => e.scanId === scanId)
          if (oldEntry) {
            // Convert old format to ScanResult
            const safeScan: ScanResult = {
              scan_id: oldEntry.scanId,
              product_id: oldEntry.product?.id || '',
              query: oldEntry.product?.name || '',
              region_key: 'US',
              aggregates: Array.isArray(oldEntry.aggregates) ? oldEntry.aggregates : [],
              verdict: oldEntry.verdict || {
                status: 'at_market',
                confidence_score: 0,
                fair_value_range: { low: 0, high: 0 },
              },
              listings: [],
              scanned_at: oldEntry.scanned_at || new Date().toISOString(),
            }
            
            // Update cache
            const newCache = new Map(get().scanCache)
            newCache.set(scanId, safeScan)
            set({ currentScan: safeScan, scanCache: newCache, error: null, loading: false })
            return
          }
        } catch (e) {
          devError('Failed to parse old scan cache:', e)
        }
      }
    } catch (e) {
      devError('Failed to load scan from localStorage cache:', e)
    }
    
    // If scan not found in cache, show error but don't create a new scan
    devError('Scan not found in cache:', scanId)
    set({ 
      error: 'Scan data not available. Please run a new scan.',
      loading: false,
    })
  },
  clearScan: () => set({ currentScan: null, error: null, lastError: null }),
  loadRecentScans: () => {
    try {
      const stored = localStorage.getItem('recent_scans')
      if (stored) {
        const scans = JSON.parse(stored) as Array<RecentScan | { id: string; query: string; timestamp: string; productId: string }>
        // Validate scan shape - support both old format (id) and new format (scanKey)
        const validScans: RecentScan[] = scans
          .map(s => {
            if (!s || !s.query || !s.timestamp) return null
            // Migrate old format to new format
            if ('id' in s && !('scanKey' in s)) {
              // Old format - try to reconstruct from cache
              const cache = get().scanCache
              const cachedScan = cache.get(s.id)
              if (cachedScan) {
                return {
                  scanKey: makeScanKey(cachedScan),
                  latestScanId: s.id,
                  query: s.query,
                  timestamp: s.timestamp,
                  productId: s.productId || '',
                  region_key: cachedScan.region_key,
                  count: 1,
                  allScanIds: [s.id],
                } as RecentScan
              } else {
                return null // Skip if we can't reconstruct
              }
            }
            // Already new format
            if ('scanKey' in s && 'latestScanId' in s) {
              return s as RecentScan
            }
            return null
          })
          .filter((s): s is RecentScan => s !== null)
        // Dedupe by scanKey (keep most recent)
        const uniqueScans = Array.from(
          new Map(validScans.map(s => [s.scanKey, s])).values()
        )
        set({ recentScans: uniqueScans })
      }
      
      // Also load full scan cache
      const cacheData = localStorage.getItem('scan_cache_full')
      if (cacheData) {
        try {
          const entries = JSON.parse(cacheData) as Array<{ id: string; scan: ScanResult }>
          const cache = new Map<string, ScanResult>()
          entries.forEach(({ id, scan }) => {
            if (id && scan && scan.scan_id) {
              cache.set(id, scan)
            }
          })
          set({ scanCache: cache })
        } catch (e) {
          devError('Failed to parse scan cache:', e)
        }
      }
      
      // Load scan history
      const historyData = localStorage.getItem('scan_history')
      if (historyData) {
        try {
          const history = JSON.parse(historyData) as ScanResult[]
          const validHistory = history.filter(s => s && s.scan_id && s.query && s.scanned_at)
          set({ scanHistory: validHistory })
        } catch (e) {
          devError('Failed to parse scan history:', e)
        }
      }
    } catch (e) {
      devError('Failed to load recent scans from localStorage:', e)
      set({ recentScans: [] })
    }
  },
  setActiveScan: (scan) => {
    if (!scan) {
      set({ currentScan: null })
      return
    }

    // Validate scan shape before setting
    if (!scan.scan_id || !scan.query) {
      devError('Invalid scan provided to setActiveScan:', scan)
      set({ 
        error: 'Invalid scan data',
        lastError: new Error('Invalid scan data'),
      })
      return
    }

    // Ensure required fields exist
    const safeScan: ScanResult = {
      ...scan,
      aggregates: Array.isArray(scan.aggregates) ? scan.aggregates : [],
      verdict: scan.verdict || {
        status: 'at_market',
        confidence_score: 0,
        fair_value_range: { low: 0, high: 0 },
      },
      listings: Array.isArray(scan.listings) ? scan.listings : [],
      scanned_at: scan.scanned_at || new Date().toISOString(),
    }

    set({ currentScan: safeScan, error: null })
  },
  getAllScans: () => {
    return get().scanHistory
  },
}))
