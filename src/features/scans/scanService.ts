import { scanEbay } from '@/providers/ebay'
import { scanFacebookMarketplace } from '@/providers/facebookMarketplace'
import { scanOfferUp } from '@/providers/offerup'
import { scanMercari } from '@/providers/mercari'
import { scanAmazonNew } from '@/providers/amazonNew'
import { supabase } from '@/services/supabase'
import type { Product, ProviderResponse, ScanResult, PriceAggregate, RegionKey, Listing } from '@/lib/types'
import type { LocationMode } from '@/lib/location'
import { calculateVerdict } from '../analysis/verdict'
import { isAccessoryOrBundle } from '@/lib/utils'

export interface ScanOptions {
  query: string
  regionKey: RegionKey
  userId?: string
  location?: LocationMode
}

export async function scanProduct(options: ScanOptions): Promise<ScanResult> {
  const { query, regionKey, userId, location } = options

  // Call all providers in parallel (mock for now)
  // Pass location info to providers that support local filtering
  const providerPromises: Promise<ProviderResponse>[] = [
    scanEbay(query, regionKey, location),
    scanFacebookMarketplace(query, regionKey, location),
    scanOfferUp(query, regionKey, location),
    scanMercari(query, regionKey, location),
  ]

  // Only scan Amazon New for new condition queries
  if (query.toLowerCase().includes('new')) {
    providerPromises.push(scanAmazonNew(query, regionKey))
  }

  const responses = await Promise.all(providerPromises)

  // Aggregate all listings and price data with product intent filtering
  const allAggregates: PriceAggregate[] = []
  const allListings: Listing[] = []
  responses.forEach(response => {
    allAggregates.push(...response.aggregates)
    
    // Filter out accessories, bundles, and unrelated items from all providers
    const filteredListings = response.listings.filter(listing => {
      // Skip listings that are clearly accessories or bundles
      if (isAccessoryOrBundle(listing.title, query)) {
        return false
      }
      return true
    })
    
    allListings.push(...filteredListings)
  })

  // Find or create product
  const canonicalName = query.toLowerCase().replace(/\s+/g, '-')
  const product = await findOrCreateProduct(query, canonicalName)

  // Calculate verdict
  const verdict = calculateVerdict(allAggregates, product.msrp)

  // Update watchlist items if user is authenticated
  if (userId && supabase) {
    try {
      // Normalize product key (stable identifier)
      const productKey = query.toLowerCase().trim().replace(/\s+/g, '-')
      
      // Find watchlist items for this product
      const { data: watchlistItems } = await supabase
        .from('watchlist_items')
        .select('id, last_price')
        .eq('user_id', userId)
        .eq('product_key', productKey)
        .eq('region_key', regionKey)

      if (watchlistItems && watchlistItems.length > 0) {
        // Calculate best price metric (fair value midpoint or national used avg)
        const nationalUsed = allAggregates.find(
          a => a.region_key === 'US' && (a.condition === 'used' || !a.condition)
        )
        const bestPrice = nationalUsed?.median_price || verdict.fair_value_range.high || 0

        // Update each watchlist item
        for (const item of watchlistItems) {
          const previousPrice = item.last_price
          const changePct = previousPrice && previousPrice > 0
            ? ((bestPrice - previousPrice) / previousPrice) * 100
            : null

          await supabase
            .from('watchlist_items')
            .update({
              last_price: bestPrice,
              last_change_pct: changePct,
            } as any)
            .eq('id', item.id)
        }
      }
    } catch (error) {
      console.error('Error updating watchlist items:', error)
      // Continue even if watchlist update fails
    }
  }

  // Save scan if user is authenticated
  let scanId = crypto.randomUUID()
  if (userId && supabase) {
    try {
      const { data, error } = await supabase
        .from('scans')
        .insert({
          user_id: userId,
          product_id: product.id,
          query,
          region_key: regionKey,
        } as any)
        .select()
        .single()

      if (!error && data) {
        scanId = (data as any).id
      }

      // Save price points
      if (allAggregates.length > 0) {
        const pricePoints = allAggregates.map(agg => ({
          product_id: product.id,
          source_type: agg.source_type,
          region_key: agg.region_key,
          date: new Date().toISOString().split('T')[0],
          avg_price: agg.avg_price,
          min_price: agg.min_price,
          max_price: agg.max_price,
          median_price: agg.median_price,
          sample_size: agg.sample_size,
          condition: agg.condition,
        }))

        await supabase.from('price_points').insert(pricePoints as any)
      }

      // Save trend point if scan has real data (not baseline/mock)
      // Only insert if we have aggregates with sample_size > 0
      const totalSampleSize = allAggregates.reduce((sum, agg) => sum + (agg.sample_size || 0), 0)
      if (totalSampleSize > 0 && allAggregates.length > 0) {
        // Extract metrics from aggregates
        const nationalUsedAgg = allAggregates.find(
          a => a.region_key === 'US' && (a.condition === 'used' || !a.condition) && a.sample_size > 0
        )
        const shippableAgg = allAggregates.find(
          a => a.source_type !== 'facebook_marketplace' && a.source_type !== 'offerup' && a.sample_size > 0
        )
        const localAgg = allAggregates.find(
          a => a.region_key !== 'US' && (a.condition === 'used' || !a.condition) && a.sample_size > 0
        )

        const series = {
          msrp: verdict.fair_value_range?.high || null,
          national_used_avg: nationalUsedAgg?.avg_price || null,
          shippable_avg: shippableAgg?.avg_price || null,
          local_avg: localAgg?.avg_price || null,
        }

        // Determine location from options
        const locationType = options.location?.kind === 'zip' ? 'zip' :
                            options.location?.kind === 'city' ? 'city' : 'none'
        const locationValue = options.location?.kind === 'zip' ? options.location.zip :
                             options.location?.kind === 'city' ? `${options.location.city}, ${options.location.region || ''}`.trim() : null

        // Insert trend point
        await supabase.from('scan_trend_points').insert({
          query: query.trim(),
          scope: regionKey === 'US' ? 'US' : 'National',
          location_type: locationType,
          location_value: locationValue,
          series: series,
          user_id: userId,
          scan_id: scanId,
        } as any)
      }

      // Deduct credit
      await deductCredit(userId)
    } catch (error) {
      console.error('Error saving scan:', error)
      // Continue even if save fails
    }
  } else {
    // Save to localStorage for unauthenticated users
    try {
      const cache = JSON.parse(localStorage.getItem('scan_cache') || '[]')
      cache.push({
        scanId,
        product,
        aggregates: allAggregates,
        verdict,
        scanned_at: new Date().toISOString(),
      })
      localStorage.setItem('scan_cache', JSON.stringify(cache.slice(-10))) // Keep last 10
    } catch (error) {
      console.error('Error caching scan:', error)
    }
  }

  return {
    scan_id: scanId,
    product_id: product.id,
    query,
    region_key: regionKey,
    aggregates: allAggregates,
    verdict,
    scanned_at: new Date().toISOString(),
    listings: allListings.slice(0, 50), // Limit to top 50 for performance
  }
}

async function findOrCreateProduct(name: string, canonicalName: string): Promise<Product> {
  // Check if product exists
  if (!supabase) {
    // Fallback if Supabase not configured
    return {
      id: crypto.randomUUID(),
      name,
      canonical_name: canonicalName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  const { data: existing } = await supabase
    .from('products')
    .select('*')
    .eq('canonical_name', canonicalName)
    .single()

  if (existing) {
    return existing as unknown as Product
  }

  // Create new product
  const { data: newProduct, error } = await supabase
    .from('products')
    .insert({
      name,
      canonical_name: canonicalName,
    } as any)
    .select()
    .single()

  if (error || !newProduct) {
    // Fallback if database fails
    return {
      id: crypto.randomUUID(),
      name,
      canonical_name: canonicalName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  return newProduct as unknown as Product
}

async function deductCredit(userId: string): Promise<void> {
  if (!supabase) return

  const { data: credits, error: fetchError } = await supabase
    .from('scan_credits')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (fetchError || !credits) {
    console.error('Error fetching credits:', fetchError)
    return
  }

  const creditsData = credits as any

  // Check if reset date has passed
  const resetDate = new Date(creditsData.reset_date)
  const today = new Date()
  const needsReset = today > resetDate

  let creditsRemaining = creditsData.credits_remaining
  if (needsReset) {
    // Reset credits based on plan tier
    const creditLimits: Record<string, number> = {
      free: 10,
      basic: 50,
      pro: 200,
      expert: 1000,
    }
    creditsRemaining = creditLimits[creditsData.plan_tier] || 10
  }

  // Deduct credit
  creditsRemaining = Math.max(0, creditsRemaining - 1)

  const nextResetDate = needsReset
    ? new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())
    : resetDate

  await (supabase as any)
    .from('scan_credits')
    .update({
      credits_remaining: creditsRemaining,
      reset_date: nextResetDate.toISOString().split('T')[0],
    })
    .eq('user_id', userId)
}
