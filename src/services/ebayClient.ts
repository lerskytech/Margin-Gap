// eBay API Client - calls Supabase Edge Functions
import type { Condition } from '@/lib/types'

interface EbayClientOptions {
  query: string
  limit?: number
  condition?: Condition
  categoryId?: string
  region_key?: string
}

interface EbayBrowseItem {
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
}

interface EbayBrowseResponse {
  itemSummaries?: EbayBrowseItem[]
  total?: number
  warnings?: Array<{
    message: string
  }>
  error?: string
}

interface EbaySoldResponse {
  items?: Array<{
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
  }>
  aggregates?: {
    avg_price: number
    median_price: number
    min_price: number
    max_price: number
    sample_size: number
  }
  meta?: {
    totalEntries?: number
    ack: string
    error?: string
    errorCode?: string
  }
  error?: string
}

const EBAY_TIMEOUT_MS = 15000 // 15 second timeout

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}

export async function fetchEbayActive(options: EbayClientOptions): Promise<EbayBrowseResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and anon key must be configured')
  }

  const params = new URLSearchParams({
    q: options.query,
    limit: (options.limit || 50).toString(),
  })

  if (options.condition) {
    params.append('condition', options.condition)
  }
  if (options.categoryId) {
    params.append('categoryId', options.categoryId)
  }
  if (options.region_key) {
    params.append('region_key', options.region_key)
  }

  const url = `${supabaseUrl}/functions/v1/ebay-search?${params.toString()}`

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
      },
      EBAY_TIMEOUT_MS
    )

    if (!response.ok) {
      const errorText = await response.text()
      return {
        itemSummaries: [],
        total: 0,
        error: `HTTP ${response.status}: ${errorText}`,
      }
    }

    const data = await response.json()
    return data as EbayBrowseResponse
  } catch (error) {
    console.error('eBay active fetch error:', error)
    return {
      itemSummaries: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function fetchEbaySold(options: EbayClientOptions): Promise<EbaySoldResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and anon key must be configured')
  }

  const params = new URLSearchParams({
    q: options.query,
    limit: (options.limit || 50).toString(),
  })

  if (options.condition) {
    params.append('condition', options.condition)
  }
  if (options.categoryId) {
    params.append('categoryId', options.categoryId)
  }
  if (options.region_key) {
    params.append('region_key', options.region_key)
  }

  const url = `${supabaseUrl}/functions/v1/ebay-sold?${params.toString()}`

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
      },
      EBAY_TIMEOUT_MS
    )

    if (!response.ok) {
      const errorText = await response.text()
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
          error: `HTTP ${response.status}: ${errorText}`,
        },
        error: `HTTP ${response.status}: ${errorText}`,
      }
    }

    const data = await response.json()
    return data as EbaySoldResponse
  } catch (error) {
    console.error('eBay sold fetch error:', error)
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
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
