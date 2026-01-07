import { useMemo } from 'react'
import type { PriceTimeSeriesPoint } from '@/lib/types'
import { formatMoney, formatPct } from '@/lib/presence'

interface TrendSummaryProps {
  timeSeriesData: PriceTimeSeriesPoint[]
  nationalUsedAvg?: number
  shippableAvg?: number
}

export function TrendSummary({ timeSeriesData, nationalUsedAvg, shippableAvg }: TrendSummaryProps) {
  const hasHistory = timeSeriesData.length >= 2
  
  // Group by source type to find prior points
  const nationalPoints = useMemo(() => {
    return timeSeriesData
      .filter(p => p.region_key === 'US' && (p.condition === 'used' || !p.condition))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [timeSeriesData])
  
  const shippablePoints = useMemo(() => {
    return timeSeriesData
      .filter(p => p.source_type !== 'facebook_marketplace' && p.source_type !== 'offerup')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [timeSeriesData])
  
  const nationalDelta = useMemo(() => {
    if (nationalPoints.length < 2) return null
    const current = nationalPoints[nationalPoints.length - 1]
    const prior = nationalPoints[nationalPoints.length - 2]
    const delta = ((current.avg_price - prior.avg_price) / prior.avg_price) * 100
    return { value: delta, current: current.avg_price }
  }, [nationalPoints])
  
  const shippableDelta = useMemo(() => {
    if (shippablePoints.length < 2) return null
    const current = shippablePoints[shippablePoints.length - 1]
    const prior = shippablePoints[shippablePoints.length - 2]
    const delta = ((current.avg_price - prior.avg_price) / prior.avg_price) * 100
    return { value: delta, current: current.avg_price }
  }, [shippablePoints])
  
  const spread = useMemo(() => {
    if (shippableAvg && nationalUsedAvg) {
      return shippableAvg - nationalUsedAvg
    }
    return null
  }, [shippableAvg, nationalUsedAvg])
  
  const scanCount = useMemo(() => {
    const uniqueDates = new Set(timeSeriesData.map(p => p.date))
    return uniqueDates.size
  }, [timeSeriesData])
  
  if (!hasHistory) {
    return (
      <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
        <p className="text-sm text-muted-foreground text-center">
          Insufficient history for trend — scan again to build timeline.
        </p>
        <p className="text-xs text-muted-foreground text-center mt-1">
          Data depth: {scanCount} scan{scanCount !== 1 ? 's' : ''}
        </p>
      </div>
    )
  }
  
  return (
    <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {nationalUsedAvg && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">National Used</div>
            <div className="font-semibold">
              {formatMoney(nationalUsedAvg)}
              {nationalDelta && (
                <span className={`ml-2 text-xs ${nationalDelta.value >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ({formatPct(nationalDelta.value)})
                </span>
              )}
            </div>
          </div>
        )}
        {shippableAvg && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Shippable</div>
            <div className="font-semibold">
              {formatMoney(shippableAvg)}
              {shippableDelta && (
                <span className={`ml-2 text-xs ${shippableDelta.value >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ({formatPct(shippableDelta.value)})
                </span>
              )}
            </div>
          </div>
        )}
        {spread !== null && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Spread</div>
            <div className="font-semibold">{formatMoney(Math.abs(spread))}</div>
          </div>
        )}
        <div>
          <div className="text-xs text-muted-foreground mb-1">Data Depth</div>
          <div className="font-semibold">{scanCount} scan{scanCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
    </div>
  )
}

