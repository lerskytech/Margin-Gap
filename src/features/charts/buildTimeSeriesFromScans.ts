// Build time series from multiple scans (for timeline charts)
import type { ScanResult, PriceTimeSeriesPoint } from '@/lib/types'

/**
 * Extract metrics from a scan's aggregates
 */
function extractMetrics(scan: ScanResult): {
  nationalUsed?: number
  shippable?: number
  localUsed?: number
  newPrice?: number
  msrp?: number
} {
  const aggregates = Array.isArray(scan.aggregates) ? scan.aggregates : []
  const metrics: {
    nationalUsed?: number
    shippable?: number
    localUsed?: number
    newPrice?: number
    msrp?: number
  } = {}

  // National Used (US region, used condition)
  const nationalUsed = aggregates.find(
    a => a && a.region_key === 'US' && (a.condition === 'used' || !a.condition) && Number.isFinite(a.avg_price) && a.sample_size > 0
  )
  if (nationalUsed) {
    metrics.nationalUsed = nationalUsed.avg_price
  }

  // Shippable (not local marketplace)
  const shippable = aggregates.find(
    a => a && a.source_type !== 'facebook_marketplace' && a.source_type !== 'offerup' && Number.isFinite(a.avg_price) && a.sample_size > 0
  )
  if (shippable) {
    metrics.shippable = shippable.avg_price
  }

  // Local Used (non-US region, used condition)
  const localUsed = aggregates.find(
    a => a && a.region_key !== 'US' && (a.condition === 'used' || !a.condition) && Number.isFinite(a.avg_price) && a.sample_size > 0
  )
  if (localUsed) {
    metrics.localUsed = localUsed.avg_price
  }

  // New condition
  const newPrice = aggregates.find(
    a => a && a.condition === 'new' && Number.isFinite(a.avg_price) && a.sample_size > 0
  )
  if (newPrice) {
    metrics.newPrice = newPrice.avg_price
  }

  // MSRP from verdict fair value range high or product msrp
  if (scan.verdict?.fair_value_range?.high && Number.isFinite(scan.verdict.fair_value_range.high)) {
    metrics.msrp = scan.verdict.fair_value_range.high
  }

  return metrics
}

/**
 * Build time series points from multiple scans
 * Each scan becomes one point per series (nationalUsed, shippable, etc.)
 */
export function buildTimeSeriesFromScans(scans: ScanResult[]): PriceTimeSeriesPoint[] {
  const points: PriceTimeSeriesPoint[] = []

  if (!Array.isArray(scans) || scans.length === 0) {
    return points
  }

  try {
    scans.forEach(scan => {
      if (!scan || !scan.scan_id || !scan.scanned_at) return

      const metrics = extractMetrics(scan)
      const scanDate = scan.scanned_at
      const scanTimestamp = new Date(scanDate).getTime()

      // Only include if timestamp is valid
      if (!Number.isFinite(scanTimestamp)) return

      // Create points for each metric that exists
      // Use valid SourceType values and map them appropriately
      if (metrics.nationalUsed !== undefined) {
        points.push({
          date: scanDate.split('T')[0], // ISO date string
          avg_price: metrics.nationalUsed,
          sample_size: 1, // One scan point
          source_type: 'ebay_active', // Use ebay_active as proxy for national used
          region_key: scan.region_key || 'US',
          condition: 'used',
        })
      }

      if (metrics.shippable !== undefined) {
        points.push({
          date: scanDate.split('T')[0],
          avg_price: metrics.shippable,
          sample_size: 1,
          source_type: 'mercari', // Use mercari as proxy for shippable
          region_key: scan.region_key || 'US',
        })
      }

      if (metrics.localUsed !== undefined) {
        points.push({
          date: scanDate.split('T')[0],
          avg_price: metrics.localUsed,
          sample_size: 1,
          source_type: 'facebook_marketplace', // Use facebook_marketplace as proxy for local used
          region_key: scan.region_key || 'US',
          condition: 'used',
        })
      }

      if (metrics.newPrice !== undefined) {
        points.push({
          date: scanDate.split('T')[0],
          avg_price: metrics.newPrice,
          sample_size: 1,
          source_type: 'amazon_new', // Use amazon_new for new condition
          region_key: scan.region_key || 'US',
          condition: 'new',
        })
      }

      // MSRP is constant, but we include it for each scan point
      // Use category_benchmark as proxy for MSRP
      if (metrics.msrp !== undefined) {
        points.push({
          date: scanDate.split('T')[0],
          avg_price: metrics.msrp,
          sample_size: 0, // No samples, it's a reference
          source_type: 'category_benchmark',
          region_key: scan.region_key || 'US',
        })
      }
    })

    // Sort by date
    points.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateA - dateB
    })
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error building time series from scans:', error)
    }
  }

  return points
}

