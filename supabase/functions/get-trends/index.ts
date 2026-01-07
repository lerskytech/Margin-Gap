// Supabase Edge Function: get-trends
// Returns historical price trends for a product/query/scope combination
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from '../_shared/cors.ts'

interface TrendRequest {
  query: string
  scope?: string // 'national' | 'local'
  region_key?: string
  rangeKey: '7d' | '30d' | '90d' | '180d' | '1y' | '2y' | '5y' | 'all'
  sources?: string[] // Optional: filter by source types
}

interface TrendPoint {
  t: string // ISO date string
  price: number
  source?: string
  sampleSize?: number
}

interface TrendsResponseSuccess {
  ok: true
  series: {
    msrp?: TrendPoint[]
    nationalUsed?: TrendPoint[]
    localUsed?: TrendPoint[]
    shippable?: TrendPoint[]
  }
  meta: {
    range: string
    points: number
    sources: string[]
    sampleSize?: number
    lastUpdated?: string
  }
}

interface TrendsResponseError {
  ok: false
  error: {
    code: 'NO_DATA' | 'NOT_ENOUGH_HISTORY' | 'MISCONFIGURED' | 'VALIDATION_FAILED' | 'UNKNOWN'
    message: string
  }
}

type TrendsResponse = TrendsResponseSuccess | TrendsResponseError

function rangeToSinceISO(rangeKey: string): string | null {
  if (rangeKey === 'all') return null
  
  const now = new Date()
  let cutoff = new Date(now)
  
  switch (rangeKey) {
    case '7d':
      cutoff.setDate(cutoff.getDate() - 7)
      break
    case '30d':
      cutoff.setDate(cutoff.getDate() - 30)
      break
    case '90d':
      cutoff.setDate(cutoff.getDate() - 90)
      break
    case '180d':
      cutoff.setDate(cutoff.getDate() - 180)
      break
    case '1y':
      cutoff.setFullYear(cutoff.getFullYear() - 1)
      break
    case '2y':
      cutoff.setFullYear(cutoff.getFullYear() - 2)
      break
    case '5y':
      cutoff.setFullYear(cutoff.getFullYear() - 5)
      break
    default:
      return null
  }
  
  return cutoff.toISOString()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as TrendRequest
    const { query, scope = 'national', region_key = 'US', rangeKey, sources } = body

    if (!query || !query.trim()) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'VALIDATION_FAILED', message: 'Query is required' }
        } as TrendsResponseError),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if Supabase is configured
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'MISCONFIGURED', message: 'Database not configured' }
        } as TrendsResponseError),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Normalize query (lowercase, trim)
    const normalizedQuery = query.trim().toLowerCase()

    // Find product by canonical name or query match
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, canonical_name, msrp')
      .or(`canonical_name.ilike.%${normalizedQuery}%,name.ilike.%${normalizedQuery}%`)
      .limit(1)

    if (productError || !products || products.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'NO_DATA', message: 'No product found for this query' }
        } as TrendsResponseError),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const product = products[0]
    const productId = product.id

    // Build date filter
    const sinceISO = rangeToSinceISO(rangeKey)
    const dateFilter = sinceISO 
      ? { date: { gte: sinceISO.split('T')[0] } } // Extract date part
      : {}

    // Query price_points table for historical data
    let pricePointsQuery = supabase
      .from('price_points')
      .select('date, avg_price, sample_size, source_type, region_key, condition')
      .eq('product_id', productId)
      .order('date', { ascending: true })

    if (sinceISO) {
      pricePointsQuery = pricePointsQuery.gte('date', sinceISO.split('T')[0])
    }

    if (sources && sources.length > 0) {
      pricePointsQuery = pricePointsQuery.in('source_type', sources)
    }

    if (scope === 'national') {
      pricePointsQuery = pricePointsQuery.eq('region_key', 'US')
    } else if (region_key && region_key !== 'US') {
      pricePointsQuery = pricePointsQuery.eq('region_key', region_key)
    }

    const { data: pricePoints, error: pointsError } = await pricePointsQuery

    if (pointsError) {
      console.error('Error querying price_points:', pointsError)
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'UNKNOWN', message: 'Database query failed' }
        } as TrendsResponseError),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!pricePoints || pricePoints.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'NO_DATA', message: 'No historical price data available' }
        } as TrendsResponseError),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (pricePoints.length < 2) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'NOT_ENOUGH_HISTORY', message: 'Not enough data points. Run more scans to build history.' }
        } as TrendsResponseError),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group points by series type
    const series: TrendsResponseSuccess['series'] = {
      msrp: product.msrp ? [{
        t: new Date().toISOString(),
        price: Number(product.msrp),
        source: 'msrp'
      }] : undefined,
      nationalUsed: [],
      localUsed: [],
      shippable: []
    }

    const sourcesSet = new Set<string>()
    let totalSampleSize = 0

    for (const point of pricePoints) {
      const date = point.date
      const price = Number(point.avg_price)
      const sampleSize = point.sample_size || 0
      const sourceType = point.source_type
      const pointRegion = point.region_key
      const condition = point.condition

      // Validate price
      if (!Number.isFinite(price) || price < 0 || price > 1000000) {
        continue // Skip invalid points
      }

      sourcesSet.add(sourceType)
      totalSampleSize += sampleSize

      const trendPoint: TrendPoint = {
        t: date,
        price,
        source: sourceType,
        sampleSize
      }

      // Categorize by region and source
      if (pointRegion === 'US' && (condition === 'used' || !condition)) {
        series.nationalUsed!.push(trendPoint)
      } else if (pointRegion !== 'US' && (condition === 'used' || !condition)) {
        series.localUsed!.push(trendPoint)
      }

      // Shippable = non-local-marketplace sources
      if (sourceType !== 'facebook_marketplace' && sourceType !== 'offerup') {
        series.shippable!.push(trendPoint)
      }
    }

    // Remove empty series
    if (series.nationalUsed!.length === 0) delete series.nationalUsed
    if (series.localUsed!.length === 0) delete series.localUsed
    if (series.shippable!.length === 0) delete series.shippable
    if (!series.msrp || series.msrp.length === 0) delete series.msrp

    // Check if we have any valid series
    const hasAnySeries = series.nationalUsed || series.localUsed || series.shippable || series.msrp
    if (!hasAnySeries) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'NO_DATA', message: 'No valid price data found' }
        } as TrendsResponseError),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get total point count
    const totalPoints = (series.nationalUsed?.length || 0) +
                       (series.localUsed?.length || 0) +
                       (series.shippable?.length || 0) +
                       (series.msrp?.length || 0)

    // Get last updated date
    const lastPoint = pricePoints[pricePoints.length - 1]
    const lastUpdated = lastPoint?.date

    const response: TrendsResponseSuccess = {
      ok: true,
      series,
      meta: {
        range: rangeKey,
        points: totalPoints,
        sources: Array.from(sourcesSet),
        sampleSize: totalSampleSize,
        lastUpdated
      }
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in get-trends:', error)
    return new Response(
      JSON.stringify({
        ok: false,
        error: { code: 'UNKNOWN', message: error instanceof Error ? error.message : 'Unknown error' }
      } as TrendsResponseError),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

