import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Timeframe, ScanResult } from '@/lib/types'
import { useScanStore } from '@/store/scanStore'
import { useAuthStore } from '@/store/authStore'
import { useWatchlistItems, useWatchlistFolders } from '@/store/watchlistStore'
import { ProductIntelligencePanel } from '@/ui/ProductIntelligencePanel'
import { Card, CardContent } from '@/ui/Card'
import { Skeleton } from '@/ui/Skeleton'
import { Button } from '@/ui/Button'
import { DebugDrawer } from '@/components/layout/DebugDrawer'
import { ConfigBanner } from '@/components/ConfigBanner'
import { AlertRuleModal } from '@/components/AlertRuleModal'
import { ProductAlertModal } from '@/components/ProductAlertModal'
import { ProfileSettings } from '@/components/ProfileSettings'
import { ExportModal } from '@/components/ExportModal'
import type { WatchlistItem } from '@/lib/types'
import { getBaselineScanResult, getBaselineTimeSeries } from '@/data/marketBaseline'
import { prepareExportData, exportAsJSON, exportAsCSV } from '@/utils/exportScan'
import { generateScanId } from '@/utils/scanId'
import { showToast } from '@/utils/toast'
import { supabase } from '@/services/supabase'

export function DashboardPage() {
  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY AT THE TOP
  const navigate = useNavigate()
  const location = useLocation()
  const { currentScan, loading, error, performScan, loadRecentScans } = useScanStore()
  const { user } = useAuthStore()
  const { items: watchlistItems, addItem } = useWatchlistItems(user?.id)
  const { folders, ensureDefaultFolder } = useWatchlistFolders(user?.id)
  const [timeframe, setTimeframe] = useState<Timeframe>('90d')
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [showProductAlertModal, setShowProductAlertModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedWatchlistItem, setSelectedWatchlistItem] = useState<WatchlistItem | null>(null)

  // Get baseline data for landing state - MUST be called before any returns
  const baselineScan = useMemo(() => getBaselineScanResult(0), [])
  const baselineTimeSeries = useMemo(() => getBaselineTimeSeries(0), [])

  useEffect(() => {
    loadRecentScans()
  }, [loadRecentScans])

  // Handle post-login intent (e.g., set-alert)
  useEffect(() => {
    if (!user) return
    
    const postLoginIntent = sessionStorage.getItem('postLoginIntent')
    if (postLoginIntent) {
      try {
        const intent = JSON.parse(postLoginIntent)
        if (intent.intent === 'set-alert') {
          sessionStorage.removeItem('postLoginIntent')
          // If we have a scan matching the query, open alert modal
          if (currentScan && currentScan.query === intent.query) {
            setShowProductAlertModal(true)
          } else if (intent.query) {
            // Perform scan first
            performScan(intent.query, user.id)
            // Modal will open after scan completes (handled in another effect)
          }
        }
      } catch (e) {
        console.error('Failed to parse postLoginIntent:', e)
        sessionStorage.removeItem('postLoginIntent')
      }
    }
  }, [user, currentScan, performScan])

  // Handle URL parameters (e.g., from extension)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const queryParam = params.get('query')
    const action = params.get('action')

    if (queryParam && action === 'set-alert') {
      // If we have a query, perform scan first, then open alert modal
      if (!currentScan || currentScan.query !== queryParam) {
        performScan(queryParam, user?.id)
      }
      // Will open modal after scan completes (handled below)
    }

    // Clean up URL params
    if (queryParam || action) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Open alert modal when scan completes and action=set-alert was in URL
  useEffect(() => {
    if (!currentScan) return
    
    const params = new URLSearchParams(window.location.search)
    const action = params.get('action')
    
    if (action === 'set-alert' && currentScan && user) {
      setShowProductAlertModal(true)
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [currentScan, user])

  const providerStatuses = useMemo(() => {
    if (!currentScan) return undefined
    
    try {
      // For now, we'll show status based on aggregates
      // In a full implementation, this would come from ProviderResponse metadata
      const statuses: Record<string, { status?: string; error?: string; requestId?: string }> = {}
      
      // Extract provider statuses from aggregates
      const aggregates = Array.isArray(currentScan.aggregates) ? currentScan.aggregates : []
      aggregates.forEach(agg => {
        if (agg && agg.source_type && !statuses[agg.source_type]) {
          statuses[agg.source_type] = {
            status: (agg.sample_size && agg.sample_size > 0) ? 'success' : 'error',
          }
        }
      })
      
      // Add ebay provider status if we have aggregates
      if (aggregates.some(a => a && (a.source_type === 'ebay_active' || a.source_type === 'ebay_sold'))) {
        statuses['ebay'] = {
          status: aggregates.some(a => a && (a.source_type === 'ebay_active' || a.source_type === 'ebay_sold') && a.sample_size && a.sample_size > 0) ? 'success' : 'error',
        }
      }
      
      return statuses
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error building provider statuses:', error)
      }
      return undefined
    }
  }, [currentScan])

  // Normalize product key for watchlist matching
  const normalizeProductKey = (query: string) => {
    return query.toLowerCase().trim().replace(/\s+/g, '-')
  }

  const isInWatchlist = currentScan
    ? watchlistItems.some(item => 
        item.product_key === normalizeProductKey(currentScan.query) &&
        item.region_key === currentScan.region_key
      )
    : false

  const currentWatchlistItem = currentScan
    ? watchlistItems.find(item =>
        item.product_key === normalizeProductKey(currentScan.query) &&
        item.region_key === currentScan.region_key
      )
    : null

  // Listen for alert modal event
  useEffect(() => {
    const handleOpenAlert = () => {
      if (currentWatchlistItem) {
        setSelectedWatchlistItem(currentWatchlistItem)
        setShowAlertModal(true)
      }
    }
    window.addEventListener('open-alert-modal' as any, handleOpenAlert as EventListener)
    return () => {
      window.removeEventListener('open-alert-modal' as any, handleOpenAlert as EventListener)
    }
  }, [currentWatchlistItem])

  // Derived values (computed after all hooks)
  const hasScan = !!currentScan
  const hasError = !!error
  const isBaseline = !hasScan
  const displayScan: ScanResult = currentScan || baselineScan
  const displayTimeSeries = currentScan 
    ? undefined // Will be built from scan
    : baselineTimeSeries
  const configBannerScanResult: ScanResult | undefined = currentScan || undefined

  // Action handlers
  const handleSetAlert = () => {
    if (isBaseline) return
    
    if (!user) {
      // Not authenticated - redirect to login with return params
      const returnPath = location.pathname + location.search
      const scanId = currentScan?.scan_id || generateScanId(currentScan?.query || '', currentScan?.region_key || 'US')
      const query = currentScan?.query || ''
      
      // Store intent for post-login
      sessionStorage.setItem('postLoginIntent', JSON.stringify({
        intent: 'set-alert',
        scanId,
        query,
        timestamp: Date.now()
      }))
      
      navigate(`/login?next=${encodeURIComponent(returnPath)}&intent=set-alert`)
      return
    }
    
    // Authenticated - open modal
    if (currentScan) {
      setShowProductAlertModal(true)
    }
  }

  const handleExportData = () => {
    if (isBaseline || !user || !currentScan) return
    setShowExportModal(true)
  }

  const handleExportJSON = () => {
    if (!currentScan) return
    const exportData = prepareExportData(currentScan)
    exportAsJSON(exportData)
    showToast('Exported JSON')
  }

  const handleExportCSV = () => {
    if (!currentScan) return
    const exportData = prepareExportData(currentScan)
    exportAsCSV(exportData)
    showToast('Exported CSV')
  }

  const handleShareReport = async () => {
    if (isBaseline || !user || !currentScan) return
    
    try {
      if (!supabase) {
        showToast('Supabase not configured')
        return
      }

      const exportData = prepareExportData(currentScan)
      const scanId = currentScan.scan_id || generateScanId(currentScan.query, currentScan.region_key)
      
      const { data, error } = await supabase.functions.invoke('create-share', {
        body: {
          scanId,
          query: currentScan.query,
          payload: exportData
        }
      })

      if (error) {
        console.error('Share error:', error)
        showToast('Failed to create share link')
        return
      }

      if (data?.token) {
        const shareUrl = `${window.location.origin}/share/${data.token}`
        await navigator.clipboard.writeText(shareUrl)
        showToast('Link copied to clipboard')
      } else {
        showToast('Failed to create share link')
      }
    } catch (error) {
      console.error('Share error:', error)
      showToast('Failed to create share link')
    }
  }

  const handleAddToWatchlist = async () => {
    if (!currentScan || !user) return
    try {
      // Ensure default folder exists
      await ensureDefaultFolder()
      
      // Get default folder (will be refetched after ensureDefaultFolder)
      const defaultFolder = folders.find(f => f.name === 'Favorites') || folders[0]

      const productKey = normalizeProductKey(currentScan.query)
      await addItem({
        productKey,
        title: currentScan.query,
        imageUrl: currentScan.listings?.[0]?.image_url,
        regionKey: currentScan.region_key,
        folderId: defaultFolder?.id,
      })
    } catch (error) {
      console.error('Failed to add to watchlist:', error)
    }
  }

  // Dev-only safety check
  if (import.meta.env.DEV) {
    console.debug('Dashboard state', { hasScan, loading, hasError, isBaseline, userId: user?.id })
  }

  // Conditional rendering (NOT early returns) - all hooks have been called
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (hasError && !hasScan) {
    return (
      <>
        <ConfigBanner />
        <Card>
          <CardContent className="p-6">
            <div className="text-red-600 font-medium mb-2">Unable to load scan data</div>
            <p className="text-sm text-muted-foreground mb-4">
              There was an error processing your scan. Please try again.
            </p>
            <Button
              onClick={() => performScan('', user?.id)}
            >
              Retry Scan
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }
  
  return (
    <>
      <ConfigBanner scanResult={configBannerScanResult} providerStatuses={isBaseline ? undefined : providerStatuses} />
      <div className={isBaseline ? 'opacity-100' : 'opacity-100 transition-opacity duration-200'}>
        <ProductIntelligencePanel
          scanResult={displayScan}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          onAddToWatchlist={user && !isBaseline ? handleAddToWatchlist : undefined}
          isInWatchlist={isInWatchlist}
          isBaseline={isBaseline}
          baselineTimeSeries={displayTimeSeries}
          onSetAlert={handleSetAlert}
          onExportData={handleExportData}
          onShareReport={handleShareReport}
          isAuthenticated={!!user}
        />
      </div>
      <DebugDrawer
        scanResult={currentScan || undefined}
        providerStatuses={providerStatuses}
        onOpenProfile={() => setShowProfileModal(true)}
        onEvaluateAlerts={async () => {
          if (!user) return
          try {
            const { supabase } = await import('@/services/supabase')
            if (!supabase) return
            const { data, error } = await supabase.functions.invoke('evaluate-alerts')
            if (error) {
              console.error('Error evaluating alerts:', error)
              alert('Failed to evaluate alerts: ' + (error.message || 'Unknown error'))
            } else {
              alert(`Alerts evaluated: ${data.triggered} triggered, ${data.skipped} skipped`)
            }
          } catch (error) {
            console.error('Error evaluating alerts:', error)
            alert('Failed to evaluate alerts')
          }
        }}
      />
      {showAlertModal && selectedWatchlistItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <AlertRuleModal
            watchlistItem={selectedWatchlistItem}
            onClose={() => {
              setShowAlertModal(false)
              setSelectedWatchlistItem(null)
            }}
          />
        </div>
      )}
      {showProductAlertModal && currentScan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <ProductAlertModal
            queryText={currentScan.query}
            onClose={() => setShowProductAlertModal(false)}
            onSuccess={() => {
              // Alert created successfully
              showToast(`Alert enabled for ${currentScan.query}`)
            }}
          />
        </div>
      )}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <ProfileSettings onClose={() => setShowProfileModal(false)} />
        </div>
      )}
      {showExportModal && (
        <ExportModal
          onExportJSON={handleExportJSON}
          onExportCSV={handleExportCSV}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </>
  )
}