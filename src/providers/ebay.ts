// eBay provider - real implementation using eBay APIs via Supabase Edge Functions
import type { ProviderResponse, Listing, PriceAggregate, Condition, RegionKey } from '@/lib/types'
import type { LocationMode } from '@/lib/location'
import { fetchEbayActive, fetchEbaySold } from '@/services/ebayClient'
import { trimOutliersSmart, isAccessoryOrBundle } from '@/lib/utils'

function mapEbayCondition(conditionId?: string, conditionText?: string): Condition {
  if (!conditionId && !conditionText) return 'used'
  
  const conditionMap: Record<string, Condition> = {
    '1000': 'new',
    '1500': 'new',
    '2000': 'used',
    '2500': 'refurbished',
    '3000': 'used',
    '4000': 'used',
    '5000': 'used',
    '6000': 'used',
  }

  if (conditionId && conditionMap[conditionId]) {
    return conditionMap[conditionId]
  }

  const lower = conditionText?.toLowerCase() || ''
  if (lower.includes('new')) return 'new'
  if (lower.includes('refurbished')) return 'refurbished'
  if (lower.includes('open box')) return 'open_box'
  return 'used'
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
  
  // Use trimmed prices for calculations, but fall back to original if too many removed
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

export async function scanEbay(
  query: string,
  regionKey: RegionKey = 'US',
  location?: LocationMode
): Promise<ProviderResponse> {
  const requestId = crypto.randomUUID()
  const today = new Date().toISOString().split('T')[0]
  
  // Determine if we should attempt local filtering
  const isLocal = location && location.kind !== 'national'
  const localZip = location?.kind === 'zip' ? location.zip : undefined
  const localCity = location?.kind === 'city' ? location.city : undefined

  try {
    // Fetch active and sold listings in parallel
    // Note: eBay Browse API supports item location filtering for active listings
    // Sold comps (Finding API) has limited local filtering support
    const [activeResult, soldResult] = await Promise.all([
      fetchEbayActive({ 
        query, 
        limit: 100, 
        region_key: regionKey,
        // Pass location for filtering if available
        ...(localZip && { zip: localZip }),
        ...(localCity && { city: localCity }),
      }),
      fetchEbaySold({ query, limit: 100, region_key: regionKey }),
    ])
    
    // Track if local data was actually available
    const localDataAvailable = isLocal && activeResult.itemSummaries && activeResult.itemSummaries.length > 0

    const listings: Listing[] = []
    const activePrices: number[] = []
    const soldPrices: number[] = []
    const activeNewPrices: number[] = []
    const activeUsedPrices: number[] = []

    // Process active listings with product intent filtering
    if (activeResult.itemSummaries && activeResult.itemSummaries.length > 0) {
      activeResult.itemSummaries.slice(0, 50).forEach((item) => {
        const price = parseFloat(item.price?.value || '0')
        if (price > 0) {
          // Filter out accessories, bundles, and unrelated items
          if (isAccessoryOrBundle(item.title, query)) {
            return // Skip this listing
          }

          const condition = mapEbayCondition(item.conditionId, item.condition)
          const hasShipping = item.shippingOptions?.some(opt => opt.shippingCostType !== 'NOT_SPECIFIED') || false

          activePrices.push(price)
          if (condition === 'new') {
            activeNewPrices.push(price)
          } else {
            activeUsedPrices.push(price)
          }

          listings.push({
            id: `ebay-active-${item.itemId}`,
            product_id: 'temp', // Will be set by scan orchestrator
            source_type: 'ebay_active',
            source_id: item.itemId,
            title: item.title,
            price,
            condition,
            url: item.itemWebUrl,
            image_url: item.image?.imageUrl,
            region_key: regionKey,
            shipping_available: hasShipping,
            pickup_available: false, // eBay Browse API doesn't provide pickup info easily
            seller_rating: item.seller?.feedbackScore,
            listing_date: new Date().toISOString(),
            scraped_at: new Date().toISOString(),
          })
        }
      })
    }

    // Process sold listings with product intent filtering
    const soldItems = soldResult.items || []
    soldItems.slice(0, 100).forEach((item) => {
      const price = parseFloat(item.price?.value || '0')
      if (price > 0) {
        // Filter out accessories, bundles, and unrelated items
        if (isAccessoryOrBundle(item.title, query)) {
          return // Skip this listing
        }
        soldPrices.push(price)
      }
    })

    // Build aggregates
    const aggregates: PriceAggregate[] = []

    // Active listings aggregate (all conditions)
    if (activePrices.length > 0) {
      const stats = calculateStats(activePrices)
      aggregates.push({
        product_id: 'temp',
        source_type: 'ebay_active',
        region_key: regionKey,
        condition: 'used', // Mixed condition
        avg_price: Math.round(stats.avg * 100) / 100,
        min_price: Math.round(stats.min * 100) / 100,
        max_price: Math.round(stats.max * 100) / 100,
        median_price: Math.round(stats.median * 100) / 100,
        sample_size: activePrices.length,
        date: today,
      })
    }

    // Active new aggregate
    if (activeNewPrices.length > 0) {
      const stats = calculateStats(activeNewPrices)
      aggregates.push({
        product_id: 'temp',
        source_type: 'ebay_active',
        region_key: regionKey,
        condition: 'new',
        avg_price: Math.round(stats.avg * 100) / 100,
        min_price: Math.round(stats.min * 100) / 100,
        max_price: Math.round(stats.max * 100) / 100,
        median_price: Math.round(stats.median * 100) / 100,
        sample_size: activeNewPrices.length,
        date: today,
      })
    }

    // Active used aggregate
    if (activeUsedPrices.length > 0) {
      const stats = calculateStats(activeUsedPrices)
      aggregates.push({
        product_id: 'temp',
        source_type: 'ebay_active',
        region_key: regionKey,
        condition: 'used',
        avg_price: Math.round(stats.avg * 100) / 100,
        min_price: Math.round(stats.min * 100) / 100,
        max_price: Math.round(stats.max * 100) / 100,
        median_price: Math.round(stats.median * 100) / 100,
        sample_size: activeUsedPrices.length,
        date: today,
      })
    }

    // Sold comps aggregate
    if (soldPrices.length > 0) {
      const stats = calculateStats(soldPrices)
      aggregates.push({
        product_id: 'temp',
        source_type: 'ebay_sold',
        region_key: regionKey,
        condition: 'used', // Sold items are typically used
        avg_price: Math.round(stats.avg * 100) / 100,
        min_price: Math.round(stats.min * 100) / 100,
        max_price: Math.round(stats.max * 100) / 100,
        median_price: Math.round(stats.median * 100) / 100,
        sample_size: soldPrices.length,
        date: today,
      })
    }

    const hasError = activeResult.error || soldResult.error
    const hasPartialData = (activePrices.length > 0 || soldPrices.length > 0) && hasError
    
    // Determine provider status considering local data availability
    let providerStatus: 'success' | 'partial' | 'error' = 'success'
    let statusMessage: string | undefined
    
    if (hasError) {
      providerStatus = hasPartialData ? 'partial' : 'error'
    } else if (isLocal && !localDataAvailable) {
      providerStatus = 'partial'
      statusMessage = 'Local data limited for this location'
    }

    return {
      listings,
      aggregates,
      metadata: {
        provider: 'ebay',
        query,
        region_key: regionKey,
        scanned_at: new Date().toISOString(),
        total_listings: listings.length,
        requestId,
        providerStatus,
        error: hasError ? (activeResult.error || soldResult.error) : statusMessage,
        localDataAvailable: isLocal ? localDataAvailable : undefined,
      },
    }
  } catch (error) {
    console.error('eBay provider error:', error)
    return {
      listings: [],
      aggregates: [],
      metadata: {
        provider: 'ebay',
        query,
        region_key: regionKey,
        scanned_at: new Date().toISOString(),
        total_listings: 0,
        requestId,
        providerStatus: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }
}