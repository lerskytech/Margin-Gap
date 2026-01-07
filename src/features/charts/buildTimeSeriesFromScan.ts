// Build time series from current scan results (point-in-time)
import type { ScanResult, PriceTimeSeriesPoint } from '@/lib/types'

export function buildTimeSeriesFromScan(scanResult: ScanResult): PriceTimeSeriesPoint[] {
  const points: PriceTimeSeriesPoint[] = []
  
  if (!scanResult || !scanResult.aggregates) {
    return points
  }

  try {
    const today = new Date().toISOString().split('T')[0]
    const aggregates = Array.isArray(scanResult.aggregates) ? scanResult.aggregates : []

    // Convert aggregates to time series points
    aggregates.forEach(agg => {
      if (!agg) return
      
      // Only include valid, finite prices
      const avgPrice = typeof agg.avg_price === 'number' && Number.isFinite(agg.avg_price) 
        ? agg.avg_price 
        : null
      const sampleSize = typeof agg.sample_size === 'number' && agg.sample_size > 0
        ? agg.sample_size
        : 0

      if (avgPrice !== null && sampleSize > 0) {
        points.push({
          date: today,
          avg_price: avgPrice,
          sample_size: sampleSize,
          source_type: agg.source_type || 'ebay_active',
          region_key: agg.region_key || 'US',
          condition: agg.condition,
        })
      }
    })
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error building time series from scan:', error)
    }
  }

  return points
}

// Build time series from baseline historical points (for landing page)
export function buildTimeSeriesFromBaseline(
  baselinePoints: PriceTimeSeriesPoint[]
): PriceTimeSeriesPoint[] {
  return baselinePoints
}
