// Supabase Edge Function: get-trends
// Fetches real scan history trends from scan_history table
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from '../_shared/cors.ts'

interface TrendRequest {
  scan_key: string
  rangeDays?: number // e.g., 7, 30, 90, 180, 365, 730, 1825, or null for all
  location_key?: string // Optional filter
  sources?: string[] // Optional filter
  user_id?: string // Optional user filter
}

interface TrendPoint {
  t: string // ISO timestamp
  msrp?: number | null
  national_used_avg?: number | null
  ebay_used_avg?: number | null
  shippable_avg?: number | null
  local_avg?: number | null
}

interface TrendResponse {
  ok: true
  points: TrendPoint[]
  meta: {
    rangeDays: number | null
    count: number
    firstAt: string | null
    lastAt: string | null
  }
} | {
  ok: false
  code: string
  message: string
}

/**
 * Convert timeframe string to rangeDays
 */
function timeframeToRangeDays(timeframe: string): number | null {
  switch (timeframe) {
    case '7d': return 7
    case '30d': return 30
    case '90d': return 90
    case '180d': return 180
    case '1y': return 365
    case '2y': return 730
    case '5y': return 1825
    case 'all': return null // null means no limit
    default: return 90 // default to 90 days
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    // Parse request body with error handling
    let body: TrendRequest & { timeframe?: string }
    try {
      body = await req.json()
    } catch (parseError) {
      console.error(`[${requestId}] JSON parse error:`, parseError)
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid JSON in request body',
          requestId,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { scan_key, rangeDays: explicitRangeDays, location_key, sources, user_id, timeframe } = body

    if (!scan_key || !scan_key.trim()) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'INVALID_REQUEST',
          message: 'scan_key is required',
          requestId,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Initialize Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'CONFIG_ERROR',
          message: 'Trends service not deployed',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Determine rangeDays from explicit value or timeframe string
    const rangeDays = explicitRangeDays !== undefined 
      ? explicitRangeDays 
      : (timeframe ? timeframeToRangeDays(timeframe) : 90)

    // Log request context for debugging
    console.log(`[${requestId}] Fetching trends:`, {
      scan_key: scan_key.trim(),
      rangeDays,
      location_key,
      sources: sources?.length || 0,
      user_id: user_id || 'anonymous',
    })

    // Build query
    let queryBuilder = supabase
      .from('scan_history')
      .select('*')
      .eq('scan_key', scan_key.trim())
      .order('created_at', { ascending: true })

    // Filter by location_key if provided
    if (location_key) {
      queryBuilder = queryBuilder.eq('location_key', location_key)
    }

    // Filter by sources if provided
    if (sources && sources.length > 0) {
      queryBuilder = queryBuilder.contains('sources', sources)
    }

    // Filter by user_id if provided
    if (user_id) {
      queryBuilder = queryBuilder.eq('user_id', user_id)
    }

    // Apply date range filter
    if (rangeDays !== null) {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - rangeDays)
      queryBuilder = queryBuilder.gte('created_at', startDate.toISOString())
    } else {
      // For 'all', use a safe max (10 years)
      const maxDate = new Date()
      maxDate.setFullYear(maxDate.getFullYear() - 10)
      queryBuilder = queryBuilder.gte('created_at', maxDate.toISOString())
    }

    const { data, error } = await queryBuilder

    if (error) {
      console.error(`[${requestId}] Database error fetching scan_history:`, {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        scan_key: scan_key.trim(),
        rangeDays,
      })
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'DATABASE_ERROR',
          message: `Database error: ${error.message || 'Unknown database error'}`,
          requestId,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!data || !Array.isArray(data)) {
      console.log(`[${requestId}] No data found:`, { scan_key: scan_key.trim(), rangeDays, count: 0 })
      return new Response(
        JSON.stringify({
          ok: true,
          points: [],
          meta: {
            rangeDays: rangeDays,
            count: 0,
            firstAt: null,
            lastAt: null,
          },
          requestId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Map to TrendPoint format
    const points: TrendPoint[] = data.map((row: any) => ({
      t: row.created_at,
      msrp: typeof row.msrp === 'number' ? row.msrp : null,
      national_used_avg: typeof row.national_used_avg === 'number' ? row.national_used_avg : null,
      ebay_used_avg: typeof row.ebay_used_avg === 'number' ? row.ebay_used_avg : null,
      shippable_avg: typeof row.shippable_avg === 'number' ? row.shippable_avg : null,
      local_avg: typeof row.local_avg === 'number' ? row.local_avg : null,
    }))

    const firstAt = points.length > 0 ? points[0].t : null
    const lastAt = points.length > 0 ? points[points.length - 1].t : null

    const duration = Date.now() - startTime
    console.log(`[${requestId}] Success:`, {
      scan_key: scan_key.trim(),
      rangeDays,
      count: points.length,
      duration: `${duration}ms`,
    })

    return new Response(
      JSON.stringify({
        ok: true,
        points,
        meta: {
          rangeDays: rangeDays,
          count: points.length,
          firstAt,
          lastAt,
        },
        requestId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[${requestId}] Unexpected error (${duration}ms):`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return new Response(
      JSON.stringify({
        ok: false,
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
