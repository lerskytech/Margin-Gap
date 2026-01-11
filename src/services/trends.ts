// Service to fetch real scan history trends from get-trends Edge Function
import type { Timeframe } from '@/lib/types'

export interface TrendPoint {
  t: string // ISO timestamp
  msrp?: number | null
  national_used_avg?: number | null
  ebay_used_avg?: number | null
  shippable_avg?: number | null
  local_avg?: number | null
}

export interface TrendRequest {
  scan_key: string
  rangeDays?: number
  location_key?: string
  sources?: string[]
  user_id?: string
  timeframe?: Timeframe // For convenience, can convert to rangeDays
}

export type TrendResponse =
  | {
      ok: true
      points: TrendPoint[]
      meta: {
        rangeDays: number | null
        count: number
        firstAt: string | null
        lastAt: string | null
      }
      requestId?: string
    }
  | {
      ok: false
      code: string
      message: string
      requestId?: string
    }

/**
 * Convert timeframe to rangeDays
 */
function timeframeToRangeDays(timeframe: Timeframe): number | null {
  switch (timeframe) {
    case '7d': return 7
    case '30d': return 30
    case '90d': return 90
    case '180d': return 180
    case '1y': return 365
    case '2y': return 730
    case '5y': return 1825
    case 'all': return null
    default: return 90
  }
}

/**
 * Fetch trends from get-trends Edge Function
 */
export async function fetchTrends(
  request: TrendRequest
): Promise<TrendResponse & { _debug?: { endpoint: string; status: number; requestId?: string } }> {
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-trends`
  
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        ok: false,
        code: 'CONFIG_ERROR',
        message: 'Trends service not deployed (missing env vars)',
        _debug: { endpoint, status: 0 },
      }
    }

    // Convert timeframe to rangeDays if provided
    const rangeDays = request.rangeDays !== undefined 
      ? request.rangeDays 
      : (request.timeframe ? timeframeToRangeDays(request.timeframe) : 90)

    // Call the Edge Function
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        scan_key: request.scan_key,
        rangeDays: rangeDays,
        location_key: request.location_key,
        sources: request.sources,
        user_id: request.user_id,
      }),
    })

    // Try to parse response as JSON
    let data: TrendResponse
    try {
      data = await response.json()
    } catch (parseError) {
      const errorText = await response.text().catch(() => 'Unable to read response')
      return {
        ok: false,
        code: 'PARSE_ERROR',
        message: `Invalid response from server: ${errorText.substring(0, 200)}`,
        requestId: undefined,
        _debug: { endpoint, status: response.status },
      }
    }

    // Add debug info to response
    const responseWithDebug = {
      ...data,
      _debug: {
        endpoint,
        status: response.status,
        requestId: data.requestId,
      },
    }

    // Handle HTTP error status codes
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Not authorized — sign in to view trend history',
        requestId: data.requestId,
        _debug: { endpoint, status: response.status, requestId: data.requestId },
      }
    }

    if (response.status === 404) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Trends service not deployed (404)',
        requestId: data.requestId,
        _debug: { endpoint, status: response.status, requestId: data.requestId },
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        code: data.ok === false ? data.code : 'FETCH_ERROR',
        message: data.ok === false ? data.message : `HTTP ${response.status}: ${response.statusText}`,
        requestId: data.requestId,
        _debug: { endpoint, status: response.status, requestId: data.requestId },
      }
    }

    return responseWithDebug
  } catch (error) {
    console.error('Error fetching trends:', error)
    return {
      ok: false,
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error fetching trends',
      _debug: { endpoint, status: 0 },
    }
  }
}
