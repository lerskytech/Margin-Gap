import { useMemo } from 'react'
import type { ScanResult, Timeframe } from '@/lib/types'
import { formatMoney, formatPct, badgeIntent, getStatusRationale } from '@/lib/presence'
import { buildTimeSeriesFromScan } from '@/features/charts/buildTimeSeriesFromScan'
import { buildTimeSeriesFromScans } from '@/features/charts/buildTimeSeriesFromScans'
import { makeChartKey, getScansForChartKey } from '@/lib/chartUtils'
import { useScanStore } from '@/store/scanStore'
import { useLocationStore } from '@/store/locationStore'
import { TIME_RANGE_ORDER, type TimeRangeKey } from '@/utils/timeRanges'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Badge } from './Badge'
import { PriceChart } from './PriceChart'
import { Button } from './Button'
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
  
  // Get scan history for chart timeline
  const { scanHistory, scanCache } = useScanStore()
  
  const timeSeriesData = useMemo(() => {
    try {
      // No baseline data - only real scans
      if (isBaseline) {
        return [] // Return empty for baseline - UI will show proper empty state
      }
      
      if (!scanResult) {
        return []
      }
      
      // Build chart key from current scan
      const chartKey = makeChartKey(scanResult)
      
      if (!chartKey) {
        // Fallback to single scan if no chart key
        const result = buildTimeSeriesFromScan(scanResult)
        return Array.isArray(result) ? result : []
      }
      
      // Get all scans matching this chart key (from history + cache)
      const allScans = [...scanHistory]
      // Also check cache for any missing scans
      for (const scan of scanCache.values()) {
        if (!allScans.find(s => s.scan_id === scan.scan_id)) {
          allScans.push(scan)
        }
      }
      
      const matchingScans = getScansForChartKey(chartKey, scanCache)
      // Also include scans from history that match
      const historyMatches = allScans.filter(s => {
        const key = makeChartKey(s)
        return key === chartKey
      })
      
      // Combine and dedupe by scan_id
      const combined = new Map<string, ScanResult>()
      matchingScans.forEach(s => combined.set(s.scan_id, s))
      historyMatches.forEach(s => combined.set(s.scan_id, s))
      // Always include current scan
      combined.set(scanResult.scan_id, scanResult)
      
      const chartScans = Array.from(combined.values())
      
      // Build time series from all matching scans
      const result = buildTimeSeriesFromScans(chartScans)
      return Array.isArray(result) ? result : []
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error building time series data:', error)
      }
      return []
    }
  }, [scanResult, isBaseline, scanHistory, scanCache])

  // Calculate reference baseline (MSRP or National Used Avg)
  const referenceBaseline = safeVerdict.fair_value_range?.high || metrics.national_avg

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Product Context Header */}
      <ProductContextHeader scanResult={scanResult} isBaseline={isBaseline} />
      
      {/* Market Snapshot Header */}
      <div className="flex items-center justify-between pb-6 border-b border-subtle">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{isBaseline ? 'Market Overview' : query}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
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
          <div className="flex gap-2">
            {onAddToWatchlist && (
              <Button
                variant={isInWatchlist ? 'outline' : 'primary'}
                size="sm"
                onClick={onAddToWatchlist}
                disabled={isInWatchlist}
              >
                {isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
              </Button>
            )}
            {isInWatchlist && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // This will be handled by parent component
                  const event = new CustomEvent('open-alert-modal', { detail: { query, region_key } })
                  window.dispatchEvent(event)
                }}
              >
                Set Alert
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Chart Section - Primary Focus */}
      <Card variant="elevated">
        <CardHeader className="pb-4 border-b border-subtle">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-xl font-semibold">
                {isBaseline 
                  ? 'Price Trends'
                  : `Price Trends — ${query} (${region_key === 'US' ? 'National' : region_key})`}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1.5">
                {isBaseline 
                  ? 'Run a scan to generate real-time price trends'
                  : 'Trendline fills in as you scan over time'}
              </p>
              {import.meta.env.DEV && !isBaseline && timeSeriesData.length > 0 && (
                <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
                  Range: {timeframe} | Points: {timeSeriesData.length}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <LocationSwitcher
                value={locationMode}
                onChange={setMode}
                recent={recentLocations}
                onRemoveRecent={removeRecent}
                onSetDefault={(mode) => setDefault(mode, undefined)}
              />
              <div className="flex gap-1.5 bg-surface2 p-1 rounded-lg border border-subtle">
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
        </CardHeader>
        <CardContent>
          <TrendSummary
            timeSeriesData={timeSeriesData}
            nationalUsedAvg={metrics.national_avg}
            shippableAvg={metrics.shippable_avg}
          />
          <PriceChart
            key={`${scanResult.scan_id}-${timeframe}`}
            timeframe={timeframe}
            msrp={referenceBaseline}
            timeSeriesData={timeSeriesData}
          />
        </CardContent>
      </Card>

      {/* Market Snapshot - Compact Secondary */}
      <Card variant="elevated">
        <CardHeader className="pb-4 border-b border-subtle">
          <CardTitle className="text-xl font-semibold">Market Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-medium">Fair Value Range</div>
              <div className="text-2xl font-semibold tabular-nums">
                {safeVerdict.fair_value_range?.low !== undefined && safeVerdict.fair_value_range?.high !== undefined
                  ? `${formatMoney(safeVerdict.fair_value_range.low)} - ${formatMoney(safeVerdict.fair_value_range.high)}`
                  : 'Data unavailable'}
              </div>
            </div>
            {metrics.national_avg && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-medium">National Used Avg</div>
                <div className="text-2xl font-semibold tabular-nums">{formatMoney(metrics.national_avg)}</div>
              </div>
            )}
            {metrics.shippable_avg && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-medium">Shippable Avg</div>
                <div className="text-2xl font-semibold tabular-nums">{formatMoney(metrics.shippable_avg)}</div>
              </div>
            )}
            {spread && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-medium">Spread</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-semibold tabular-nums">{formatPct(spread.pct)}</div>
                  <span className="text-xs text-muted-foreground">
                    ({formatMoney(Math.abs(spread.diff))})
                  </span>
                </div>
              </div>
            )}
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-medium">Status</div>
              <div className="flex flex-col gap-2">
                <Badge variant={verdictBadgeVariant} className="w-fit">{verdictLabel}</Badge>
                <span className="text-xs text-muted-foreground">
                  {getStatusRationale(safeVerdict.status, safeVerdict.delta_percent)}
                </span>
              </div>
            </div>
            {safeVerdict.confidence_score !== undefined && safeVerdict.confidence_score > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-medium">Confidence</div>
                <div className="space-y-2">
                  <div className="text-2xl font-semibold tabular-nums">{(safeVerdict.confidence_score * 100).toFixed(0)}%</div>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold text-primary mb-2">1</div>
                <h4 className="font-medium mb-1">Search any product</h4>
                <p className="text-sm text-muted-foreground">
                  Enter a product name to scan across multiple marketplaces
                </p>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary mb-2">2</div>
                <h4 className="font-medium mb-1">We aggregate pricing data</h4>
                <p className="text-sm text-muted-foreground">
                  National and local pricing data from eBay, Facebook Marketplace, and more
                </p>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary mb-2">3</div>
                <h4 className="font-medium mb-1">Track trends and fair value</h4>
                <p className="text-sm text-muted-foreground">
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
