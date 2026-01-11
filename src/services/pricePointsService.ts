// Service to fetch price_points from Supabase for chart time series
import { supabase } from './supabase'
import type { PriceTimeSeriesPoint, Timeframe } from '@/lib/types'
import { timeframeStartMs } from '@/utils/timeframe'

export interface PricePointRow {
  id: string
  scan_id: string | null
  scan_key: string
  query: string
  scope: string
  location_type: 'national' | 'zip' | 'city'
  location_value: string | null
  created_at: string
  msrp: number | null
  national_used_avg: number | null
  shippable_avg: number | null
  local_avg: number | null
  source_count: number | null
  sample_size: number
  confidence: number | null
}

/**
 * Fetch price_points for a given scan_key, filtered by timeframe
 */
export async function fetchPricePoints(
  scanKey: string,
  timeframe: Timeframe
): Promise<PriceTimeSeriesPoint[]> {
  if (!scanKey) {
    return []
  }

  try {
    // Calculate start date based on timeframe
    const startMs = timeframeStartMs(timeframe)
    const startDate = startMs ? new Date(startMs).toISOString() : null

    // Build query
    let query = supabase
      .from('price_points')
      .select('*')
      .eq('scan_key', scanKey)
      .order('created_at', { ascending: true })

    // Filter by date if timeframe is not 'all'
    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching price_points:', error)
      return []
    }

    if (!data || !Array.isArray(data)) {
      return []
    }

    // Transform to PriceTimeSeriesPoint format
    const points: PriceTimeSeriesPoint[] = []

    data.forEach((row: PricePointRow) => {
      // Add national used series
      if (row.national_used_avg !== null && Number.isFinite(row.national_used_avg)) {
        points.push({
          date: row.created_at.split('T')[0],
          avg_price: row.national_used_avg,
          sample_size: row.sample_size || 0,
          source_type: 'ebay_active',
          region_key: 'US',
          condition: 'used',
        })
      }

      // Add shippable series
      if (row.shippable_avg !== null && Number.isFinite(row.shippable_avg)) {
        points.push({
          date: row.created_at.split('T')[0],
          avg_price: row.shippable_avg,
          sample_size: row.sample_size || 0,
          source_type: 'mercari',
          region_key: row.scope === 'national' ? 'US' : row.location_value || 'US',
        })
      }

      // Add local avg series
      if (row.local_avg !== null && Number.isFinite(row.local_avg)) {
        points.push({
          date: row.created_at.split('T')[0],
          avg_price: row.local_avg,
          sample_size: row.sample_size || 0,
          source_type: 'facebook_marketplace',
          region_key: row.location_value || 'US',
          condition: 'used',
        })
      }

      // Add MSRP as category_benchmark if available
      if (row.msrp !== null && Number.isFinite(row.msrp)) {
        points.push({
          date: row.created_at.split('T')[0],
          avg_price: row.msrp,
          sample_size: 0, // Reference value, no samples
          source_type: 'category_benchmark',
          region_key: 'US',
        })
      }
    })

    // Sort by date ascending
    points.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateA - dateB
    })

    return points
  } catch (error) {
    console.error('Error in fetchPricePoints:', error)
    return []
  }
}

/**
 * Compute scan_key from query, scope, sources, and location
 * Matches the format used in the Edge Function
 */
export function computeScanKey(
  query: string,
  regionKey: string,
  aggregates: Array<{ source_type: string }>
): string {
  const normalizedQuery = query.trim().toLowerCase()
  const scope = regionKey === 'US' ? 'national' : 'local'
  const sourceTypes = [...new Set(aggregates.map(a => a.source_type).filter(Boolean))].sort().join(',')
  const locationType = regionKey === 'US' ? 'national' : (regionKey.includes('zip:') ? 'zip' : 'city')
  const locationValue = regionKey === 'US' ? null : (regionKey.includes('zip:') ? regionKey.split(':')[2] : regionKey.split(':').slice(1).join(':'))
  return `${normalizedQuery}|${scope}|${sourceTypes}|${locationType}:${locationValue || 'national'}`
}
