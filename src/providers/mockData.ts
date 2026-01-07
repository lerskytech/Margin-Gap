import type { Listing, PriceAggregate, Condition, SourceType, RegionKey } from '@/lib/types'

// Mock data generator for realistic testing
export function generateMockData(
  query: string,
  sourceType: SourceType,
  regionKey: RegionKey
): { listings: Listing[]; aggregates: PriceAggregate[] } {
  // Generate deterministic mock data based on query
  const basePrice = getBasePrice(query)
  const isLocal = regionKey !== 'US' && regionKey.includes(':')
  
  // Price variation by region (local markets are typically 5-15% different)
  const regionMultiplier = isLocal ? 0.92 : 1.0
  
  const listings: Listing[] = []
  const prices: number[] = []
  
  // Generate 15-25 mock listings
  const count = 18 + (query.length % 10)
  for (let i = 0; i < count; i++) {
    const variation = 0.7 + (Math.sin(i * 0.5) * 0.3) + (Math.random() * 0.2)
    const price = Math.round(basePrice * regionMultiplier * variation)
    const condition: Condition = i % 4 === 0 ? 'new' : i % 3 === 0 ? 'refurbished' : 'used'
    
    prices.push(price)
    
    listings.push({
      id: `${sourceType}-${regionKey}-${i}`,
      product_id: 'mock-product-id',
      source_type: sourceType,
      source_id: `mock-${i}`,
      title: `${query} - ${condition === 'new' ? 'Brand New' : condition}`,
      price,
      condition,
      url: `https://example.com/${sourceType}/${i}`,
      image_url: `https://picsum.photos/200/200?random=${i}`,
      region_key: regionKey,
      shipping_available: sourceType !== 'facebook_marketplace' || i % 2 === 0,
      pickup_available: sourceType === 'facebook_marketplace' || sourceType === 'offerup',
      seller_rating: 4.0 + Math.random(),
      listing_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      scraped_at: new Date().toISOString(),
    })
  }
  
  // Calculate aggregates
  prices.sort((a, b) => a - b)
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length
  const min = prices[0]
  const max = prices[prices.length - 1]
  const median = prices[Math.floor(prices.length / 2)]
  
  const aggregates: PriceAggregate[] = [
    {
      product_id: 'mock-product-id',
      source_type: sourceType,
      region_key: regionKey,
      condition: 'used',
      avg_price: avg,
      min_price: min,
      max_price: max,
      median_price: median,
      sample_size: prices.length,
      date: new Date().toISOString().split('T')[0],
    },
  ]
  
  return { listings, aggregates }
}

function getBasePrice(query: string): number {
  const normalized = query.toLowerCase()
  
  // Sample product price bases
  if (normalized.includes('iphone') || normalized.includes('iphone 13')) return 450
  if (normalized.includes('iphone 14')) return 650
  if (normalized.includes('iphone 15')) return 800
  if (normalized.includes('airpods')) return 120
  if (normalized.includes('macbook')) return 1200
  if (normalized.includes('nike') || normalized.includes('jordan')) return 150
  if (normalized.includes('pokemon') || normalized.includes('card')) return 25
  if (normalized.includes('playstation') || normalized.includes('ps5')) return 450
  if (normalized.includes('xbox')) return 350
  
  // Default base price
  return 200
}
