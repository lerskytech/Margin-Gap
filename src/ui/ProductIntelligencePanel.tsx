import { useMemo, useEffect, useState } from 'react'
import type { ScanResult, Timeframe, PriceTimeSeriesPoint } from '@/lib/types'
import { formatMoney, formatPct, badgeIntent, getStatusRationale } from '@/lib/presence'
import { fetchTrends, type TrendPoint } from '@/services/trends'
import { makeScanKey } from '@/lib/scanKey'
import { useLocationStore } from '@/store/locationStore'
import { useAuthStore } from '@/store/authStore'
import { TIME_RANGE_ORDER, type TimeRangeKey } from '@/utils/timeRanges'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Badge } from './Badge'
import { PriceChart } from './PriceChart'
import { Button } from './Button'
import { Input } from '@/ui/Input'
import { ListingsPreview } from './ListingsPreview'
import { TrendSummary } from './TrendSummary'
import { ProductContextHeader } from '@/components/ProductContextHeader'
import { SuggestedScans } from '@/components/SuggestedScans'
import { ActionsDropdown } from '@/components/ui/ActionsDropdown'
import { LocationSwitcher } from '@/components/ui/LocationSwitcher'

interface ProductIntelligencePanelProps {
  scanResult: ScanResult
  timeframe: Timeframe
  onTimeframeChange: (timeframe: Timeframe) => void
  onAddToWatchlist?: () => void
  isInWatchlist?: boolean
  isBaseline?: boolean
  onSetAlert?: () => void
  onExportData?: () => void
  onShareReport?: () => void
  isAuthenticated?: boolean
}

export function ProductIntelligencePanel({
  scanResult,
  timeframe,
  onTimeframeChange,
  onAddToWatchlist,
  isInWatchlist,
  isBaseline = false,
  onSetAlert,
  onExportData,
  onShareReport,
  isAuthenticated = false,
}: ProductIntelligencePanelProps) {
  // Derived state flags for Actions panel
  const isAuthed = Boolean(isAuthenticated)
  
  // Auth store for user ID
  const { user } = useAuthStore()
  
  // Location store
  const { mode: locationMode, recent: recentLocations, setMode, removeRecent, setDefault } = useLocationStore()
  
  const { verdict, aggregates, query, region_key, scanned_at } = scanResult

  // Ensure aggregates is always an array
  const safeAggregates = Array.isArray(aggregates) ? aggregates : []
  const safeVerdict = verdict || {
    status: 'at_market' as const,
    confidence_score: 0,
    fair_value_range: { low: 0, high: 0 },
  }

  const metrics = useMemo(() => {
    if (!Array.isArray(safeAggregates) || safeAggregates.length === 0) {
      return {
        local_avg: undefined,
        national_avg: undefined,
        shippable_avg: undefined,
        new_avg: undefined,
      }
    }

    const localUsed = safeAggregates.find(
      a => a && a.region_key !== 'US' && (a.condition === 'used' || !a.condition)
    )
    const nationalUsed = safeAggregates.find(
      a => a && a.region_key === 'US' && (a.condition === 'used' || !a.condition)
    )
    const shippable = safeAggregates.find(
      a => a && a.source_type !== 'facebook_marketplace' && a.source_type !== 'offerup'
    )
    const newAgg = safeAggregates.find(a => a && a.condition === 'new')

    return {
      local_avg: localUsed?.avg_price && Number.isFinite(localUsed.avg_price) ? localUsed.avg_price : undefined,
      national_avg: nationalUsed?.avg_price && Number.isFinite(nationalUsed.avg_price) ? nationalUsed.avg_price : undefined,
      shippable_avg: shippable?.avg_price && Number.isFinite(shippable.avg_price) ? shippable.avg_price : undefined,
      new_avg: newAgg?.avg_price && Number.isFinite(newAgg.avg_price) ? newAgg.avg_price : undefined,
    }
  }, [safeAggregates])

  const totalSamples = useMemo(() => {
    if (!Array.isArray(safeAggregates) || safeAggregates.length === 0) {
      return 0
    }
    return safeAggregates.reduce((sum, agg) => {
      const size = agg?.sample_size && Number.isFinite(agg.sample_size) ? agg.sample_size : 0
      return sum + size
    }, 0)
  }, [safeAggregates])

  const spread = useMemo(() => {
    if (metrics.shippable_avg && metrics.national_avg) {
      const diff = metrics.shippable_avg - metrics.national_avg
      const pct = metrics.national_avg > 0 ? (diff / metrics.national_avg) * 100 : 0
      return { diff, pct }
    }
    return null
  }, [metrics])

  const verdictBadgeVariant = badgeIntent(safeVerdict.status)
  const verdictLabel =
    safeVerdict.status === 'undervalued' ? 'Undervalued' :
    safeVerdict.status === 'overpriced' ? 'Overpriced' : 'At Market'

  const timeframes: TimeRangeKey[] = TIME_RANGE_ORDER
  const lastUpdated = isBaseline
    ? 'Market snapshot — updated recently'
    : new Date(scanned_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
  
  // Scan history trends state
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([])
  const [trendsLoading, setTrendsLoading] = useState(false)
  const [trendsError, setTrendsError] = useState<{ code: string; message: string } | null>(null)
  const [dataIntegrity, setDataIntegrity] = useState<'verified' | 'unavailable' | 'error'>('unavailable')
  const [locationInput, setLocationInput] = useState<string>('')
  const [appliedLocation, setAppliedLocation] = useState<{ type: 'zip' | 'city' | 'none'; value?: string } | null>(null)

  // Compute scan_key for trend fetching
  const scanKey = useMemo(() => {
    if (isBaseline || !scanResult) return null
    return makeScanKey(scanResult, locationMode)
  }, [scanResult, locationMode, isBaseline])

  // Determine location_key from location
  const locationKey = useMemo(() => {
    if (appliedLocation) {
      if (appliedLocation.type === 'zip') {
        return `ZIP:${appliedLocation.value}`
      } else if (appliedLocation.type === 'city') {
        return `CITY:${appliedLocation.value}`
      }
    } else if (locationMode.kind === 'zip') {
      return `ZIP:${locationMode.zip}`
    } else if (locationMode.kind === 'city') {
      return `CITY:${locationMode.city},${locationMode.region || ''}`
    }
    return 'US'
  }, [appliedLocation, locationMode])

  // Fetch scan history trends with AbortController for cancellation
  useEffect(() => {
    // No baseline data - only real scans
    if (isBaseline || !scanResult || !scanKey) {
      setTrendPoints([])
      setTrendsError(null)
      setDataIntegrity('unavailable')
      return
    }

    // AbortController to cancel in-flight requests when dependencies change
    const abortController = new AbortController()
    
    setTrendsLoading(true)
    setTrendsError(null)
    setDataIntegrity('unavailable')

    // Extract sources from aggregates
    const sources = [...new Set((scanResult.aggregates || []).map(a => a.source_type).filter(Boolean))]

    // Fetch trends from Edge Function
    fetchTrends({
      scan_key: scanKey,
      timeframe: timeframe,
      location_key: locationKey,
      sources: sources,
      user_id: user?.id,
    })
      .then((response) => {
        // Check if request was aborted
        if (abortController.signal.aborted) {
          return
        }
        
        if (response.ok) {
          // If ok:true but points.length < 2, this is not an error - it's just insufficient data
          if (response.points.length < 2) {
            setTrendPoints(response.points)
            setTrendsError(null) // Not an error - just not enough data
            setDataIntegrity('unavailable')
          } else {
            setTrendPoints(response.points)
            setTrendsError(null)
            setDataIntegrity('verified')
          }
        } else {
          setTrendPoints([])
          // Store error with debug info
          setTrendsError({
            code: response.code,
            message: response.message,
            requestId: response.requestId,
            debug: response._debug,
          } as any)
          setDataIntegrity('error')
        }
      })
      .catch((error) => {
        // Ignore abort errors
        if (abortController.signal.aborted) {
          return
        }
        
        if (import.meta.env.DEV) {
          console.error('Error fetching trends:', error)
        }
        setTrendPoints([])
        setTrendsError({
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Failed to load trends',
          debug: { endpoint: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-trends`, status: 0 },
        } as any)
        setDataIntegrity('error')
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setTrendsLoading(false)
        }
      })

    // Cleanup: abort request if dependencies change
    return () => {
      abortController.abort()
    }
  }, [scanResult, scanKey, timeframe, isBaseline, locationKey, user?.id])

  // Convert TrendPoint[] to PriceTimeSeriesPoint format for chart compatibility
  const timeSeriesData = useMemo(() => {
    if (!trendPoints || trendPoints.length === 0) {
      return []
    }

    const converted: PriceTimeSeriesPoint[] = []

    // Add national used series
    trendPoints.forEach(point => {
      if (point.national_used_avg !== null && point.national_used_avg !== undefined && Number.isFinite(point.national_used_avg)) {
        converted.push({
          date: point.t.split('T')[0],
          avg_price: point.national_used_avg,
          sample_size: 1,
          source_type: 'ebay_active',
          region_key: scanResult.region_key === 'US' ? 'US' : scanResult.region_key,
          condition: 'used',
        })
      }
    })

    // Add eBay used series
    trendPoints.forEach(point => {
      if (point.ebay_used_avg !== null && point.ebay_used_avg !== undefined && Number.isFinite(point.ebay_used_avg)) {
        converted.push({
          date: point.t.split('T')[0],
          avg_price: point.ebay_used_avg,
          sample_size: 1,
          source_type: 'ebay_active',
          region_key: scanResult.region_key === 'US' ? 'US' : scanResult.region_key,
          condition: 'used',
        })
      }
    })

    // Add local avg series
    trendPoints.forEach(point => {
      if (point.local_avg !== null && point.local_avg !== undefined && Number.isFinite(point.local_avg)) {
        converted.push({
          date: point.t.split('T')[0],
          avg_price: point.local_avg,
          sample_size: 1,
          source_type: 'facebook_marketplace',
          region_key: locationKey !== 'US' ? locationKey : scanResult.region_key,
          condition: 'used',
        })
      }
    })

    // Add shippable avg series
    trendPoints.forEach(point => {
      if (point.shippable_avg !== null && point.shippable_avg !== undefined && Number.isFinite(point.shippable_avg)) {
        converted.push({
          date: point.t.split('T')[0],
          avg_price: point.shippable_avg,
          sample_size: 1,
          source_type: 'mercari',
          region_key: scanResult.region_key === 'US' ? 'US' : scanResult.region_key,
        })
      }
    })

    // Add MSRP as category_benchmark
    trendPoints.forEach(point => {
      if (point.msrp !== null && point.msrp !== undefined && Number.isFinite(point.msrp)) {
        converted.push({
          date: point.t.split('T')[0],
          avg_price: point.msrp,
          sample_size: 0, // Reference value
          source_type: 'category_benchmark',
          region_key: 'US',
        })
      }
    })

    return converted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [trendPoints, scanResult.region_key, locationKey])

  const handleApplyLocation = () => {
    const trimmed = locationInput.trim()
    if (!trimmed) {
      setAppliedLocation({ type: 'none' })
      return
    }

    // Check if it's a ZIP (5 digits)
    if (/^\d{5}$/.test(trimmed)) {
      setAppliedLocation({ type: 'zip', value: trimmed })
    } else {
      // Treat as city
      setAppliedLocation({ type: 'city', value: trimmed })
    }
  }

  // Calculate reference baseline (MSRP or National Used Avg)
  const referenceBaseline = safeVerdict.fair_value_range?.high || metrics.national_avg

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto px-1 sm:px-0">
      {/* Product Context Header */}
      <ProductContextHeader scanResult={scanResult} isBaseline={isBaseline} />
      
      {/* Market Snapshot Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-subtle">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{isBaseline ? 'Market Overview' : query}</h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 sm:mt-2 text-xs sm:text-sm text-muted-foreground">
            {isBaseline ? (
              <span>Live price intelligence across popular consumer products</span>
            ) : (
              <>
                <span className="font-medium">{region_key === 'US' ? 'National' : region_key}</span>
                <span className="text-muted-foreground/50">•</span>
                <span className="font-mono text-xs tabular-nums">Updated {lastUpdated}</span>
              </>
            )}
          </div>
        </div>
        {!isBaseline && (
          <div className="flex gap-2 flex-shrink-0">
            {onAddToWatchlist && (
              <Button
                variant={isInWatchlist ? 'outline' : 'primary'}
                size="sm"
                onClick={onAddToWatchlist}
                disabled={isInWatchlist}
                className="flex-1 sm:flex-initial"
              >
                {isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
              </Button>
            )}
            {isInWatchlist && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const event = new CustomEvent('open-alert-modal', { detail: { query, region_key } })
                  window.dispatchEvent(event)
                }}
                className="flex-1 sm:flex-initial"
              >
                Set Alert
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Chart Section - Primary Focus */}
      <Card variant="elevated">
        <CardHeader className="pb-3 sm:pb-4 border-b border-subtle">
          {/* Mobile: Stack header in two rows */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 sm:block">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg sm:text-xl font-semibold">
                    {isBaseline 
                      ? 'Price Trends'
                      : (
                        <>
                          <span className="hidden sm:inline">Price Trends — {query} ({region_key === 'US' ? 'National' : region_key})</span>
                          <span className="sm:hidden">Price Trends</span>
                        </>
                      )}
                  </CardTitle>
                  {/* Data Integrity Badge */}
                  {!isBaseline && (
                    <Badge
                      variant={
                        dataIntegrity === 'verified' ? 'default' :
                        dataIntegrity === 'unavailable' ? 'secondary' : 'danger'
                      }
                      className="text-xs"
                    >
                      {dataIntegrity === 'verified' ? 'Verified' :
                       dataIntegrity === 'unavailable' ? 'Unavailable' : 'Error'}
                    </Badge>
                  )}
                </div>
                {/* Mobile: Actions dropdown in title row */}
                <div className="sm:hidden">
                  <ActionsDropdown
                    isBaseline={isBaseline}
                    isAuthenticated={isAuthed}
                    onSetAlert={onSetAlert || (() => {})}
                    onExportData={onExportData || (() => {})}
                    onShareReport={onShareReport || (() => {})}
                  />
                </div>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-1.5">
                {isBaseline 
                  ? 'Run a scan to generate real-time price trends'
                  : 'Trendline fills in as you scan over time'}
              </p>
              {!isBaseline && timeSeriesData.length > 0 && (() => {
                const uniqueDates = new Set(timeSeriesData.map(p => p.date)).size
                const needsMoreData = uniqueDates < 2 && timeframe !== 'all'
                return needsMoreData ? (
                  <p className="text-xs text-muted-foreground/70 mt-1.5 italic">
                    Timeframe won't change until we have more than one scan saved for this product.
                  </p>
                ) : null
              })()}
              {import.meta.env.DEV && !isBaseline && timeSeriesData.length > 0 && (
                <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
                  Range: {timeframe} | Points: {timeSeriesData.length}
                </p>
              )}
            </div>
            {/* Desktop: Controls row */}
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              <LocationSwitcher
                value={locationMode}
                onChange={setMode}
                recent={recentLocations}
                onRemoveRecent={removeRecent}
                onSetDefault={(mode) => setDefault(mode, undefined)}
              />
              <div className="flex gap-1.5 bg-surface2 p-1 rounded-lg border border-subtle flex-wrap">
                {timeframes.map(tf => (
                  <Button
                    key={tf}
                    variant={timeframe === tf ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => onTimeframeChange(tf)}
                    className={timeframe === tf ? 'shadow-sm' : ''}
                  >
                    {tf}
                  </Button>
                ))}
              </div>
              <ActionsDropdown
                isBaseline={isBaseline}
                isAuthenticated={isAuthed}
                onSetAlert={onSetAlert || (() => {})}
                onExportData={onExportData || (() => {})}
                onShareReport={onShareReport || (() => {})}
              />
            </div>
          </div>
          {/* Mobile: Location input row */}
          <div className="flex sm:hidden items-center gap-2 overflow-x-auto -mx-2 px-2 pb-1 scrollbar-none">
            <LocationSwitcher
              value={locationMode}
              onChange={setMode}
              recent={recentLocations}
              onRemoveRecent={removeRecent}
              onSetDefault={(mode) => setDefault(mode, undefined)}
            />
            {/* Location input for ZIP/City */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Input
                type="text"
                placeholder="ZIP or City"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyLocation()}
                className="w-20 text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleApplyLocation}
                className="text-xs"
              >
                Apply
              </Button>
            </div>
          </div>
          {/* Desktop: Location input */}
          <div className="hidden sm:flex items-center gap-2">
            <Input
              type="text"
              placeholder="ZIP or City"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyLocation()}
              className="w-24 text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleApplyLocation}
              className="text-xs"
            >
              Apply
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <TrendSummary
            timeSeriesData={timeSeriesData}
            nationalUsedAvg={metrics.national_avg}
            shippableAvg={metrics.shippable_avg}
          />
          {trendsLoading && (
            <div className="w-full h-[320px] sm:h-[420px] lg:h-[500px] flex items-center justify-center border border-border rounded">
              <div className="text-center text-muted-foreground">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm">Loading trend history...</p>
              </div>
            </div>
          )}
          {!trendsLoading && trendsError && (
            <div className="w-full h-[320px] sm:h-[420px] lg:h-[500px] flex items-center justify-center border border-border rounded">
              <div className="text-center text-muted-foreground px-4 max-w-md">
                <p className="text-sm font-medium mb-2">Failed to load trends</p>
                <p className="text-xs text-muted-foreground/60 mb-3">
                  {trendsError.code === 'UNAUTHORIZED' 
                    ? 'Not authorized — sign in to view trend history.'
                    : trendsError.code === 'NOT_FOUND' || trendsError.code === 'CONFIG_ERROR'
                    ? 'Trends service not deployed.'
                    : trendsError.code === 'FETCH_ERROR' && trendsError.message.includes('500')
                    ? 'Trends service error — check Supabase logs.'
                    : trendsError.message}
                </p>
                {/* Debug details */}
                {(trendsError as any).debug && (
                  <div className="text-xs text-muted-foreground/40 font-mono mb-3 space-y-0.5">
                    <div>Endpoint: {(trendsError as any).debug.endpoint || 'N/A'}</div>
                    <div>Status: {(trendsError as any).debug.status || 'N/A'}</div>
                    {(trendsError as any).requestId && (
                      <div>Request ID: {(trendsError as any).requestId}</div>
                    )}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTrendsError(null)
                    // Trigger refetch by updating a dependency
                    const currentLocation = appliedLocation || (locationMode.kind === 'national' ? { type: 'none' as const } : locationMode.kind === 'zip' ? { type: 'zip' as const, value: locationMode.zip } : { type: 'city' as const, value: `${locationMode.city}, ${locationMode.region || ''}`.trim() })
                    setAppliedLocation(currentLocation)
                  }}
                >
                  Retry
                </Button>
              </div>
            </div>
          )}
          {!trendsLoading && !trendsError && trendPoints.length < 2 && (
            <div className="w-full h-[320px] sm:h-[420px] lg:h-[500px] flex items-center justify-center border border-border rounded">
              <div className="text-center text-muted-foreground px-4">
                <p className="text-sm font-medium mb-1">History required</p>
                <p className="text-xs text-muted-foreground/60 mb-3">
                  Run 2+ scans over time to unlock trendlines
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      // Trigger a new scan by calling the scan handler
                      // This will be handled by the parent component
                      window.dispatchEvent(new CustomEvent('trigger-scan'))
                    }}
                  >
                    Run another scan
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Placeholder for extension CTA
                      window.open('https://chrome.google.com/webstore', '_blank')
                    }}
                  >
                    Enable Auto-Scan via Chrome Extension
                  </Button>
                </div>
              </div>
            </div>
          )}
          {!trendsLoading && !trendsError && trendPoints.length >= 2 && timeSeriesData.length > 0 && (
            <PriceChart
              key={`chart-${scanResult.scan_id}-${timeframe}-${appliedLocation?.type || locationMode.kind}-${appliedLocation?.value || (locationMode.kind === 'national' ? 'national' : locationMode.kind === 'zip' ? locationMode.zip : `${locationMode.city}-${locationMode.region}`)}`}
              timeframe={timeframe}
              msrp={referenceBaseline}
              timeSeriesData={timeSeriesData}
            />
          )}
          {!trendsLoading && !trendsError && trendPoints.length >= 2 && timeSeriesData.length === 0 && (
            <div className="w-full h-[320px] sm:h-[420px] lg:h-[500px] flex items-center justify-center border border-border rounded">
              <div className="text-center text-muted-foreground px-4">
                <p className="text-sm font-medium mb-1">No valid trend data in this range</p>
                <p className="text-xs text-muted-foreground/60">Try a different timeframe or run more scans</p>
              </div>
            </div>
          )}
          {!trendsLoading && !trendsError && trendPoints.length >= 2 && (
            <div className="mt-2 text-xs text-muted-foreground text-center">
              <span className="font-mono">Filtered: {timeSeriesData.length} points</span>
              <span className="mx-2">•</span>
              <span>Range: {timeframe}</span>
              {import.meta.env.DEV && (
                <>
                  <span className="mx-2">•</span>
                  <span>{trendPoints.length} scan{trendPoints.length !== 1 ? 's' : ''}</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Market Snapshot - Compact Secondary */}
      <Card variant="elevated">
        <CardHeader className="pb-3 sm:pb-4 border-b border-subtle">
          <CardTitle className="text-lg sm:text-xl font-semibold">Market Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            <div className="col-span-2 sm:col-span-1">
              <div className="text-xs sm:text-xs uppercase tracking-wide text-muted-foreground mb-1 sm:mb-2 font-medium">Fair Value Range</div>
              <div className="text-lg sm:text-xl lg:text-2xl font-semibold tabular-nums">
                {safeVerdict.fair_value_range?.low !== undefined && safeVerdict.fair_value_range?.high !== undefined
                  ? `${formatMoney(safeVerdict.fair_value_range.low)} - ${formatMoney(safeVerdict.fair_value_range.high)}`
                  : 'Data unavailable'}
              </div>
            </div>
            {metrics.national_avg && (
              <div>
                <div className="text-xs sm:text-xs uppercase tracking-wide text-muted-foreground mb-1 sm:mb-2 font-medium">National Used Avg</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-semibold tabular-nums">{formatMoney(metrics.national_avg)}</div>
              </div>
            )}
            {metrics.shippable_avg && (
              <div>
                <div className="text-xs sm:text-xs uppercase tracking-wide text-muted-foreground mb-1 sm:mb-2 font-medium">Shippable Avg</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-semibold tabular-nums">{formatMoney(metrics.shippable_avg)}</div>
              </div>
            )}
            {spread && (
              <div>
                <div className="text-xs sm:text-xs uppercase tracking-wide text-muted-foreground mb-1 sm:mb-2 font-medium">Spread</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-lg sm:text-xl lg:text-2xl font-semibold tabular-nums">{formatPct(spread.pct)}</div>
                  <span className="text-xs text-muted-foreground">
                    ({formatMoney(Math.abs(spread.diff))})
                  </span>
                </div>
              </div>
            )}
            <div>
              <div className="text-xs sm:text-xs uppercase tracking-wide text-muted-foreground mb-1 sm:mb-2 font-medium">Status</div>
              <div className="flex flex-col gap-1 sm:gap-2">
                <Badge variant={verdictBadgeVariant} className="w-fit">{verdictLabel}</Badge>
                <span className="text-xs text-muted-foreground">
                  {getStatusRationale(safeVerdict.status, safeVerdict.delta_percent)}
                </span>
              </div>
            </div>
            {safeVerdict.confidence_score !== undefined && safeVerdict.confidence_score > 0 && (
              <div>
                <div className="text-xs sm:text-xs uppercase tracking-wide text-muted-foreground mb-1 sm:mb-2 font-medium">Confidence</div>
                <div className="space-y-1 sm:space-y-2">
                  <div className="text-lg sm:text-xl lg:text-2xl font-semibold tabular-nums">{(safeVerdict.confidence_score * 100).toFixed(0)}%</div>
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, safeVerdict.confidence_score * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          {totalSamples > 0 && (
            <div className="mt-6 pt-6 border-t border-subtle flex items-center gap-2 text-xs text-muted-foreground">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="font-medium">Data Depth:</span> {totalSamples} listings across {safeAggregates.length} source{safeAggregates.length !== 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>


      {/* Suggested Scans */}
      {!isBaseline && (
        <SuggestedScans currentQuery={query} />
      )}

      {/* Listings Preview */}
      {!isBaseline && (
        <ListingsPreview 
          listings={scanResult.listings} 
          referenceAvg={metrics.shippable_avg || metrics.national_avg}
        />
      )}

      {/* How This Works - Only show on baseline */}
      {isBaseline && (
        <Card className="rounded-xl border border-border shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">How This Works</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-4">
              <div>
                <div className="text-xl sm:text-2xl font-bold text-primary mb-1 sm:mb-2">1</div>
                <h4 className="font-medium mb-1 text-sm sm:text-base">Search any product</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Enter a product name to scan across multiple marketplaces
                </p>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-primary mb-1 sm:mb-2">2</div>
                <h4 className="font-medium mb-1 text-sm sm:text-base">We aggregate pricing data</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  National and local pricing data from eBay, Facebook Marketplace, and more
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="text-xl sm:text-2xl font-bold text-primary mb-1 sm:mb-2">3</div>
                <h4 className="font-medium mb-1 text-sm sm:text-base">Track trends and fair value</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Monitor price spreads, trends, and fair value ranges over time
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
