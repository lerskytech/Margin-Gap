// Chart utility functions
import type { ScanResult } from '@/lib/types'

/**
 * Create a stable chart key from a scan result
 * Groups scans by query + region for timeline building
 */
export function makeChartKey(scan: ScanResult | null): string | null {
  if (!scan || !scan.query) return null
  const query = scan.query.toLowerCase().trim()
  const region = scan.region_key || 'US'
  return `${query}|${region}`
}

/**
 * Get all scans matching a chart key from the cache
 */
export function getScansForChartKey(
  chartKey: string | null,
  scanCache: Map<string, ScanResult>
): ScanResult[] {
  if (!chartKey) return []
  
  const matching: ScanResult[] = []
  for (const scan of scanCache.values()) {
    const key = makeChartKey(scan)
    if (key === chartKey) {
      matching.push(scan)
    }
  }
  
  // Sort by scanned_at timestamp (oldest first)
  return matching.sort((a, b) => {
    const tsA = new Date(a.scanned_at || 0).getTime()
    const tsB = new Date(b.scanned_at || 0).getTime()
    return tsA - tsB
  })
}

