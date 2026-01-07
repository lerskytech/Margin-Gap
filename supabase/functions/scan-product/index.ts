// Supabase Edge Function: scan-product
// Wraps the existing scanProduct logic for extension/API access
// Returns optional provenance and meta fields for trust & transparency
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from '../_shared/cors.ts'

interface ScanRequest {
  query: string
  region_key?: string
  user_id?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID()
  const generatedAt = new Date().toISOString()

  try {
    const { query, region_key = 'US', user_id } = await req.json() as ScanRequest

    if (!query || !query.trim()) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Call providers in parallel (eBay is primary, others optional for speed)
    const providerPromises = [
      fetch(`${supabaseUrl}/functions/v1/ebay-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          query: query.trim(),
          region_key: region_key
        })
      })
    ]

    // For extension, prioritize speed - use eBay primarily
    // Other providers can be added later for completeness
    const responses = await Promise.all(providerPromises)
    
    const allAggregates: any[] = []
    const allListings: any[] = []
    const providerStatuses: any[] = []

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i]
      const providerName = i === 0 ? 'ebay' : 'unknown'
      
      if (response.ok) {
        try {
          const data = await response.json()
          if (data.aggregates) {
            allAggregates.push(...data.aggregates)
          }
          if (data.listings) {
            allListings.push(...data.listings)
          }
          providerStatuses.push({
            provider: providerName,
            status: 'success',
            sampleSize: data.aggregates?.[0]?.sample_size || 0
          })
        } catch (error) {
          providerStatuses.push({
            provider: providerName,
            status: 'error',
            error: 'Failed to parse response'
          })
        }
      } else {
        providerStatuses.push({
          provider: providerName,
          status: 'error',
          error: `HTTP ${response.status}`
        })
      }
    }

    const aggregates = allAggregates
    const listings = allListings

    // Calculate verdict using IQR method (matching web app logic)
    // If no aggregates, return empty result (not an error - extension handles gracefully)
    if (aggregates.length === 0) {
      const emptyResult = {
        scan_id: crypto.randomUUID(),
        product_id: '',
        query: query.trim(),
        region_key: region_key,
        aggregates: [],
        verdict: {
          status: 'at_market' as const,
          confidence_score: 0,
          fair_value_range: { low: 0, high: 0 }
        },
        scanned_at: generatedAt,
        listings: [],
        meta: {
          requestId,
          generatedAt,
          cacheHit: false
        },
        provenance: {
          totalListings: 0,
          sources: [],
          updatedAt: generatedAt
        }
      }
      
      return new Response(
        JSON.stringify(emptyResult),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Collect all price points (prioritize median, include avg for larger samples)
    const allPrices: number[] = []
    aggregates.forEach((agg: any) => {
      if (agg.median_price && agg.median_price > 0) {
        allPrices.push(agg.median_price)
      }
      if (agg.sample_size >= 5 && agg.avg_price && agg.avg_price > 0) {
        allPrices.push(agg.avg_price)
      }
    })

    if (allPrices.length === 0) {
      const emptyResult = {
        scan_id: crypto.randomUUID(),
        product_id: '',
        query: query.trim(),
        region_key: region_key,
        aggregates: aggregates,
        verdict: {
          status: 'at_market' as const,
          confidence_score: 0,
          fair_value_range: { low: 0, high: 0 }
        },
        scanned_at: generatedAt,
        listings: listings.slice(0, 20),
        meta: {
          requestId,
          generatedAt,
          cacheHit: false
        },
        provenance: {
          totalListings: aggregates.reduce((sum: number, agg: any) => sum + (agg.sample_size || 0), 0),
          sources: aggregates.map((agg: any) => ({
            name: agg.source_type || 'unknown',
            count: agg.sample_size || 0
          })),
          updatedAt: generatedAt
        }
      }
      
      return new Response(
        JSON.stringify(emptyResult),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Sort prices
    allPrices.sort((a, b) => a - b)
    
    // Calculate quartiles for IQR-based fair value range
    const q25Index = Math.floor(allPrices.length * 0.25)
    const q75Index = Math.floor(allPrices.length * 0.75)
    const fairLow = Math.round(allPrices[q25Index] || allPrices[0] || 0)
    const fairHigh = Math.round(allPrices[q75Index] || allPrices[allPrices.length - 1] || 0)
    const median = allPrices.length % 2 === 0
      ? Math.round((allPrices[Math.floor(allPrices.length / 2) - 1] + allPrices[Math.floor(allPrices.length / 2)]) / 2)
      : Math.round(allPrices[Math.floor(allPrices.length / 2)] || 0)

    // Confidence scoring (simplified but effective)
    const totalSampleSize = aggregates.reduce((sum: number, agg: any) => sum + (agg.sample_size || 0), 0)
    const sourceCount = aggregates.length
    const avgSampleSize = totalSampleSize / sourceCount
    
    // Sample size confidence (logarithmic)
    const sampleConfidence = Math.min(Math.log10(Math.max(avgSampleSize, 1)) / Math.log10(100), 1)
    
    // Source diversity confidence
    const sourceDiversityConfidence = Math.min(sourceCount / 3, 1)
    
    // Price consistency (coefficient of variation)
    const mean = allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length
    const variance = allPrices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / allPrices.length
    const stdDev = Math.sqrt(variance)
    const cv = mean > 0 ? stdDev / mean : 1
    const varianceConfidence = Math.max(0, 1 - Math.min(cv / 0.3, 1))
    
    // Range tightness
    const rangeWidth = fairHigh - fairLow
    const rangePercent = mean > 0 ? (rangeWidth / mean) : 1
    const rangeTightnessConfidence = Math.max(0, 1 - Math.min(rangePercent / 0.6, 1))
    
    // Weighted confidence
    const confidence_score = Math.round((
      sampleConfidence * 0.35 +
      sourceDiversityConfidence * 0.25 +
      varianceConfidence * 0.25 +
      rangeTightnessConfidence * 0.15
    ) * 100) / 100

    const verdict = {
      status: 'at_market' as const,
      confidence_score: confidence_score,
      fair_value_range: {
        low: fairLow,
        high: fairHigh
      }
    }

    // Save scan if user_id provided
    if (user_id) {
      try {
        // Find or create product
        const canonicalName = query.toLowerCase().trim().replace(/\s+/g, '-')
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id')
          .eq('canonical_name', canonicalName)
          .single()

        let productId = existingProduct?.id

        if (!productId) {
          const { data: newProduct } = await supabase
            .from('products')
            .insert({
              name: query.trim(),
              canonical_name: canonicalName
            } as any)
            .select('id')
            .single()
          
          productId = newProduct?.id
        }

        if (productId) {
          // Save scan
          await supabase
            .from('scans')
            .insert({
              user_id: user_id,
              product_id: productId,
              query: query.trim(),
              region_key: region_key
            } as any)

          // Save price points
          if (aggregates.length > 0) {
            const pricePoints = aggregates.map((agg: any) => ({
              product_id: productId,
              source_type: agg.source_type,
              region_key: agg.region_key,
              date: new Date().toISOString().split('T')[0],
              avg_price: agg.avg_price,
              min_price: agg.min_price,
              max_price: agg.max_price,
              median_price: agg.median_price,
              sample_size: agg.sample_size,
              condition: agg.condition
            }))

            await supabase.from('price_points').insert(pricePoints as any)
          }
        }
      } catch (error) {
        console.error('Error saving scan:', error)
        // Continue even if save fails
      }
    }

    // Build provenance
    const totalListings = aggregates.reduce((sum: number, agg: any) => sum + (agg.sample_size || 0), 0)
    const sources = aggregates.map((agg: any) => ({
      name: agg.source_type || 'unknown',
      count: agg.sample_size || 0
    }))

    const result = {
      scan_id: crypto.randomUUID(),
      product_id: '',
      query: query.trim(),
      region_key: region_key,
      aggregates: aggregates,
      verdict: verdict,
      scanned_at: generatedAt,
      listings: listings.slice(0, 20), // Limit for extension
      // Optional meta fields (additive, non-breaking)
      meta: {
        requestId,
        generatedAt,
        cacheHit: false,
        providerStatuses: providerStatuses
      },
      // Optional provenance fields (additive, non-breaking)
      provenance: {
        totalListings,
        sources,
        updatedAt: generatedAt
      }
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Scan error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Scan failed',
        meta: {
          requestId,
          generatedAt,
          cacheHit: false
        }
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
