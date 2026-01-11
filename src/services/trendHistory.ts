// Service to fetch scan-history based trends from scan_trend_points table
import { supabase } from './supabase'
import type { Timeframe } from '@/lib/types'
import { timeframeStartMs } from '@/utils/timeframe'

export interface TrendPoint {
  ts: string // ISO timestamp
  msrp?: number | null
  nationalUsed?: number | null
  localAvg?: number | null
  shippableAvg?: number | null
}

export interface TrendHistoryRequest {
  query: string
  scope: string // 'US' | 'National'
  location?: {
    type: 'zip' | 'city' | 'none'
    value?: string
  }
  timeframe: Timeframe
  userId?: string
}

export type TrendHistoryResponse =
  | { ok: true; points: TrendPoint[] }
  | { ok: false; message: string }

/**
 * Fetch trend history from scan_trend_points table
 */
export async function fetchTrendHistory(
  request: TrendHistoryRequest
): Promise<TrendHistoryResponse> {
  try {
    // Check if Supabase is enabled and configured
    if (!supabase) {
      return {
        ok: false,
        message: 'Trends unavailable (backend not configured)',
      }
    }

    const { query, scope, location, timeframe, userId } = request

    // Build query
    let queryBuilder = supabase
      .from('scan_trend_points')
      .select('*')
      .eq('query', query.trim())
      .eq('scope', scope)
      .order('created_at', { ascending: true })

    // Filter by location
    if (location) {
      queryBuilder = queryBuilder.eq('location_type', location.type)
      if (location.value) {
        queryBuilder = queryBuilder.eq('location_value', location.value)
      } else {
        queryBuilder = queryBuilder.is('location_value', null)
      }
    } else {
      queryBuilder = queryBuilder.eq('location_type', 'none')
    }

    // Filter by user if provided
    if (userId) {
      queryBuilder = queryBuilder.eq('user_id', userId)
    } else {
      queryBuilder = queryBuilder.is('user_id', null)
    }

    // Apply timeframe filter
    const startMs = timeframeStartMs(timeframe)
    if (startMs !== null) {
      const startDate = new Date(startMs).toISOString()
      queryBuilder = queryBuilder.gte('created_at', startDate)
    }

    const { data, error } = await queryBuilder

    if (error) {
      console.error('Error fetching trend history:', error)
      return {
        ok: false,
        message: 'Failed to load trend history',
      }
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return {
        ok: true,
        points: [],
      }
    }

    // Map to TrendPoint format
    const points: TrendPoint[] = data.map((row: any) => {
      const series = row.series || {}
      return {
        ts: row.created_at,
        msrp: typeof series.msrp === 'number' ? series.msrp : null,
        nationalUsed: typeof series.national_used_avg === 'number' ? series.national_used_avg : null,
        localAvg: typeof series.local_avg === 'number' ? series.local_avg : null,
        shippableAvg: typeof series.shippable_avg === 'number' ? series.shippable_avg : null,
      }
    })

    return {
      ok: true,
      points,
    }
  } catch (error) {
    console.error('Error in fetchTrendHistory:', error)
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
