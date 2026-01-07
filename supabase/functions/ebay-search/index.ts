// Supabase Edge Function: eBay Active Listings Search
// This function calls eBay Browse API to fetch active listings
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

// OAuth token cache (in-memory, expires after 24 hours)
let oauthToken: string | null = null
let tokenExpiry: number = 0

interface EbaySearchParams {
  q: string
  limit?: number
  condition?: string
  categoryId?: string
  region_key?: string
}

interface EbayBrowseResponse {
  itemSummaries?: Array<{
    itemId: string
    title: string
    price?: {
      value: string
      currency: string
    }
    image?: {
      imageUrl: string
    }
    itemWebUrl: string
    condition?: string
    conditionId?: string
    shippingOptions?: Array<{
      shippingCostType: string
      shippingCost?: {
        value: string
        currency: string
      }
    }>
    itemLocation?: {
      country: string
      postalCode?: string
    }
    seller?: {
      username: string
      feedbackScore?: number
      feedbackPercentage?: string
    }
  }>
  total?: number
  warnings?: Array<{
    message: string
  }>
}

async function getEbayOAuthToken(): Promise<string> {
  const now = Date.now()
  if (oauthToken && now < tokenExpiry) {
    return oauthToken
  }

  const clientId = Deno.env.get('EBAY_OAUTH_CLIENT_ID')
  const clientSecret = Deno.env.get('EBAY_OAUTH_CLIENT_SECRET')
  const env = Deno.env.get('EBAY_ENV') || 'production' // 'sandbox' or 'production'

  if (!clientId || !clientSecret) {
    throw new Error('EBAY_OAUTH_CLIENT_ID and EBAY_OAUTH_CLIENT_SECRET must be set')
  }

  const authUrl = env === 'sandbox'
    ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
    : 'https://api.ebay.com/identity/v1/oauth2/token'

  const credentials = btoa(`${clientId}:${clientSecret}`)
  
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`eBay OAuth failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  oauthToken = data.access_token
  // Set expiry to 90% of actual expiry for safety
  tokenExpiry = now + (data.expires_in * 1000 * 0.9)

  return oauthToken
}

function mapEbayCondition(conditionId?: string, conditionText?: string): string {
  if (!conditionId && !conditionText) return 'used'
  
  const conditionMap: Record<string, string> = {
    '1000': 'new',
    '1500': 'new_other',
    '2000': 'used',
    '2500': 'refurbished',
    '3000': 'used',
    '4000': 'used',
    '5000': 'used',
    '6000': 'used',
  }

  if (conditionId && conditionMap[conditionId]) {
    const mapped = conditionMap[conditionId]
    return mapped === 'new_other' ? 'new' : mapped
  }

  const lower = conditionText?.toLowerCase() || ''
  if (lower.includes('new')) return 'new'
  if (lower.includes('refurbished')) return 'refurbished'
  if (lower.includes('open box')) return 'open_box'
  return 'used'
}

async function searchEbayActive(params: EbaySearchParams): Promise<EbayBrowseResponse> {
  const token = await getEbayOAuthToken()
  const env = Deno.env.get('EBAY_ENV') || 'production'
  const marketplaceId = Deno.env.get('EBAY_MARKETPLACE_ID') || 'EBAY_US'
  
  const baseUrl = env === 'sandbox'
    ? 'https://api.sandbox.ebay.com/buy/browse/v1'
    : 'https://api.ebay.com/buy/browse/v1'

  const limit = Math.min(params.limit || 100, 200) // eBay max is 200
  const queryParams = new URLSearchParams({
    q: params.q,
    limit: limit.toString(),
    'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
  })

  if (params.categoryId) {
    queryParams.append('category_ids', params.categoryId)
  }

  // Map condition if provided
  const conditionFilterMap: Record<string, string> = {
    'new': 'NEW',
    'used': 'USED',
    'refurbished': 'CERTIFIED_REFURBISHED',
  }
  if (params.condition && conditionFilterMap[params.condition]) {
    queryParams.append('filter', `conditions:{${conditionFilterMap[params.condition]}}`)
  }

  const url = `${baseUrl}/item_summary/search?${queryParams.toString()}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`eBay API error: ${response.status} ${errorText}`)
  }

  return await response.json()
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const q = url.searchParams.get('q')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const condition = url.searchParams.get('condition') || undefined
    const categoryId = url.searchParams.get('categoryId') || undefined
    const region_key = url.searchParams.get('region_key') || 'US'

    if (!q) {
      return new Response(
        JSON.stringify({ error: 'Query parameter "q" is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const result = await searchEbayActive({
      q,
      limit,
      condition,
      categoryId,
      region_key,
    })

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('eBay search error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        itemSummaries: [],
        total: 0,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
