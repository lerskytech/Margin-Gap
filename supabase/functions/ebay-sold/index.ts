// Supabase Edge Function: eBay Sold/Completed Items
// This function uses eBay Finding API to fetch completed/sold listings
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { parseXml } from '../_shared/xml.ts'
import { trimOutliersSmart } from '../_shared/outliers.ts'

// OAuth token cache (in-memory, expires after 24 hours)
let oauthToken: string | null = null
let tokenExpiry: number = 0

interface EbaySoldParams {
  q: string
  limit?: number
  condition?: string
  categoryId?: string
  region_key?: string
}

interface EbaySoldItem {
  itemId: string
  title: string
  viewItemURL: string
  price: {
    value: string
    currency: string
  }
  shippingCost?: {
    value: string
    currency: string
  }
  endTime?: string
  conditionDisplayName?: string
  conditionId?: string
  location?: string
  galleryURL?: string
}

interface EbaySoldResponse {
  items?: EbaySoldItem[]
  aggregates?: {
    avg_price: number
    median_price: number
    min_price: number
    max_price: number
    sample_size: number
  }
  meta: {
    totalEntries?: number
    ack: string
    error?: string
    errorCode?: string
    rawSnippet?: string
  }
}

async function getEbayOAuthToken(): Promise<string> {
  const now = Date.now()
  if (oauthToken && now < tokenExpiry) {
    return oauthToken
  }

  const clientId = Deno.env.get('EBAY_OAUTH_CLIENT_ID')
  const clientSecret = Deno.env.get('EBAY_OAUTH_CLIENT_SECRET')
  const env = Deno.env.get('EBAY_ENV') || 'production'

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
  tokenExpiry = now + (data.expires_in * 1000 * 0.9)

  return oauthToken
}

function calculateStats(prices: number[]): {
  avg: number
  median: number
  min: number
  max: number
} {
  if (prices.length === 0) {
    return { avg: 0, median: 0, min: 0, max: 0 }
  }

  // Apply outlier trimming for more accurate statistics
  const trimmedPrices = trimOutliersSmart(prices)
  
  // Use trimmed prices if we have enough data, otherwise fall back to original
  const pricesToUse = trimmedPrices.length >= Math.max(3, prices.length * 0.5) 
    ? trimmedPrices 
    : prices

  if (pricesToUse.length === 0) {
    return { avg: 0, median: 0, min: 0, max: 0 }
  }

  const sorted = [...pricesToUse].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const avg = pricesToUse.reduce((sum, p) => sum + p, 0) / pricesToUse.length
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)]

  return { avg, median, min, max }
}

async function searchEbaySold(params: EbaySoldParams): Promise<EbaySoldResponse> {
  const appId = Deno.env.get('EBAY_APP_ID')
  const env = Deno.env.get('EBAY_ENV') || 'production'
  const globalId = Deno.env.get('EBAY_GLOBAL_ID') || 'EBAY-US'

  if (!appId) {
    throw new Error('EBAY_APP_ID must be set for Finding API')
  }

  const baseUrl = env === 'sandbox'
    ? 'https://svcs.sandbox.ebay.com/services/search/FindingService/v1'
    : 'https://svcs.ebay.com/services/search/FindingService/v1'

  const limit = Math.min(params.limit || 100, 100) // Finding API max is 100

  // Build XML request for Finding API
  const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<findCompletedItemsRequest xmlns="http://www.ebay.com/marketplace/search/v1/services">
  <keywords>${escapeXml(params.q)}</keywords>
  <paginationInput>
    <entriesPerPage>${limit}</entriesPerPage>
  </paginationInput>
  <itemFilter>
    <name>SoldItemsOnly</name>
    <value>true</value>
  </itemFilter>
  ${params.condition ? `<itemFilter>
    <name>Condition</name>
    <value>${escapeXml(params.condition)}</value>
  </itemFilter>` : ''}
  ${params.categoryId ? `<categoryId>${escapeXml(params.categoryId)}</categoryId>` : ''}
  <globalId>${globalId}</globalId>
</findCompletedItemsRequest>`

  const url = `${baseUrl}?OPERATION-NAME=findCompletedItems&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${appId}&RESPONSE-DATA-FORMAT=XML&REST-PAYLOAD`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      'Accept': 'application/xml',
    },
    body: xmlRequest,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`eBay Finding API error: ${response.status} ${errorText}`)
  }

  const xmlText = await response.text()
  return parseFindingApiResponse(xmlText)
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function parseFindingApiResponse(xml: string): EbaySoldResponse {
  const parseResult = parseXml(xml)
  
  if (parseResult.error) {
    return {
      items: [],
      aggregates: {
        avg_price: 0,
        median_price: 0,
        min_price: 0,
        max_price: 0,
        sample_size: 0,
      },
      meta: {
        ack: 'Failure',
        error: parseResult.error,
        errorCode: 'XML_PARSE_FAILED',
        rawSnippet: xml.substring(0, 250),
      },
    }
  }

  const doc = parseResult.document
  if (!doc) {
    return {
      items: [],
      aggregates: {
        avg_price: 0,
        median_price: 0,
        min_price: 0,
        max_price: 0,
        sample_size: 0,
      },
      meta: {
        ack: 'Failure',
        error: 'Failed to parse XML document',
        errorCode: 'XML_PARSE_FAILED',
      },
    }
  }

  // Try DOMParser path first
  if (typeof doc.querySelector === 'function') {
    return parseWithDOMParser(doc, xml)
  }

  // Fallback to simple parser
  return parseWithSimpleParser(doc, xml)
}

function parseWithDOMParser(doc: any, xml: string): EbaySoldResponse {
  try {
    const ackEl = doc.querySelector('ack')
    const ack = ackEl?.textContent?.trim() || 'Failure'
    
    if (ack !== 'Success') {
      const errorEl = doc.querySelector('errorMessage error errorMessage')
      const errorMsg = errorEl?.textContent?.trim() || 'Unknown error'
      const errorCodeEl = doc.querySelector('errorMessage error errorId')
      const errorCode = errorCodeEl?.textContent?.trim() || 'EBAY_UPSTREAM_FAILED'
      
      return {
        items: [],
        aggregates: {
          avg_price: 0,
          median_price: 0,
          min_price: 0,
          max_price: 0,
          sample_size: 0,
        },
        meta: {
          ack,
          error: errorMsg,
          errorCode,
        },
      }
    }

    const totalEntriesEl = doc.querySelector('paginationOutput totalEntries')
    const totalEntries = totalEntriesEl ? parseInt(totalEntriesEl.textContent?.trim() || '0', 10) : 0

    const items: EbaySoldItem[] = []
    const itemElements = doc.querySelectorAll('searchResult item')
    
    for (const itemEl of itemElements) {
      const itemIdEl = itemEl.querySelector('itemId')
      const titleEl = itemEl.querySelector('title')
      const viewUrlEl = itemEl.querySelector('viewItemURL')
      const priceEl = itemEl.querySelector('sellingStatus currentPrice')
      const shippingEl = itemEl.querySelector('shippingInfo shippingServiceCost')
      const conditionEl = itemEl.querySelector('condition conditionDisplayName')
      const conditionIdEl = itemEl.querySelector('condition conditionId')
      const locationEl = itemEl.querySelector('location')
      const galleryEl = itemEl.querySelector('galleryURL')
      const endTimeEl = itemEl.querySelector('listingInfo endTime')

      const itemId = itemIdEl?.textContent?.trim()
      const title = titleEl?.textContent?.trim()
      const viewItemURL = viewUrlEl?.textContent?.trim()
      const priceValue = priceEl?.textContent?.trim()
      const priceCurrency = priceEl?.getAttribute('currencyId')?.trim()
      
      if (!itemId || !title || !priceValue) continue

      const item: EbaySoldItem = {
        itemId,
        title,
        viewItemURL: viewItemURL || '',
        price: {
          value: priceValue,
          currency: priceCurrency || 'USD',
        },
      }

      if (shippingEl) {
        const shippingValue = shippingEl.textContent?.trim()
        const shippingCurrency = shippingEl.getAttribute('currencyId')?.trim()
        if (shippingValue) {
          item.shippingCost = {
            value: shippingValue,
            currency: shippingCurrency || 'USD',
          }
        }
      }

      if (conditionEl) {
        item.conditionDisplayName = conditionEl.textContent?.trim()
      }
      if (conditionIdEl) {
        item.conditionId = conditionIdEl.textContent?.trim()
      }
      if (locationEl) {
        item.location = locationEl.textContent?.trim()
      }
      if (galleryEl) {
        item.galleryURL = galleryEl.textContent?.trim()
      }
      if (endTimeEl) {
        item.endTime = endTimeEl.textContent?.trim()
      }

      items.push(item)
    }

    // Calculate aggregates
    const prices = items
      .map(item => parseFloat(item.price.value))
      .filter(price => !isNaN(price) && price > 0)

    const stats = calculateStats(prices)

    return {
      items,
      aggregates: {
        avg_price: Math.round(stats.avg * 100) / 100,
        median_price: Math.round(stats.median * 100) / 100,
        min_price: Math.round(stats.min * 100) / 100,
        max_price: Math.round(stats.max * 100) / 100,
        sample_size: prices.length,
      },
      meta: {
        totalEntries,
        ack: 'Success',
      },
    }
  } catch (error) {
    return {
      items: [],
      aggregates: {
        avg_price: 0,
        median_price: 0,
        min_price: 0,
        max_price: 0,
        sample_size: 0,
      },
      meta: {
        ack: 'Failure',
        error: error instanceof Error ? error.message : 'Parse error',
        errorCode: 'XML_PARSE_FAILED',
        rawSnippet: xml.substring(0, 250),
      },
    }
  }
}

function parseWithSimpleParser(doc: any, xml: string): EbaySoldResponse {
  // Use simple parser fallback
  const items: EbaySoldItem[] = doc.items || []
  const ack = doc.ack || 'Failure'
  const totalEntries = doc.totalEntries || 0

  if (ack !== 'Success' || items.length === 0) {
    return {
      items: [],
      aggregates: {
        avg_price: 0,
        median_price: 0,
        min_price: 0,
        max_price: 0,
        sample_size: 0,
      },
      meta: {
        ack,
        error: ack !== 'Success' ? 'eBay API returned failure' : 'No items found',
        errorCode: 'EBAY_UPSTREAM_FAILED',
      },
    }
  }

  // Calculate aggregates
  const prices = items
    .map(item => parseFloat(item.price?.value || '0'))
    .filter(price => !isNaN(price) && price > 0)

  const stats = calculateStats(prices)

  return {
    items,
    aggregates: {
      avg_price: Math.round(stats.avg * 100) / 100,
      median_price: Math.round(stats.median * 100) / 100,
      min_price: Math.round(stats.min * 100) / 100,
      max_price: Math.round(stats.max * 100) / 100,
      sample_size: prices.length,
    },
    meta: {
      totalEntries,
      ack: 'Success',
    },
  }
}

serve(async (req) => {
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

    const result = await searchEbaySold({
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
    console.error('eBay sold error:', error)
    
    let errorCode = 'EBAY_UPSTREAM_FAILED'
    if (error instanceof Error) {
      if (error.message.includes('OAuth')) {
        errorCode = 'EBAY_AUTH_FAILED'
      } else if (error.message.includes('429') || error.message.includes('rate')) {
        errorCode = 'RATE_LIMITED'
      }
    }
    
    return new Response(
      JSON.stringify({ 
        items: [],
        aggregates: {
          avg_price: 0,
          median_price: 0,
          min_price: 0,
          max_price: 0,
          sample_size: 0,
        },
        meta: {
          ack: 'Failure',
          error: error instanceof Error ? error.message : 'Unknown error',
          errorCode,
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})