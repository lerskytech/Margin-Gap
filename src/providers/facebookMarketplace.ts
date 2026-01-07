import type { ProviderResponse } from '@/lib/types'
import type { LocationMode } from '@/lib/location'
import { generateMockData } from './mockData'

// Facebook Marketplace provider (stub for future integration)
export async function scanFacebookMarketplace(
  query: string,
  regionKey: string = 'US',
  location?: LocationMode
): Promise<ProviderResponse> {
  // Mock implementation - replace with actual Facebook Marketplace API integration
  // Facebook Marketplace naturally supports local filtering
  const { listings, aggregates } = generateMockData(query, 'facebook_marketplace', regionKey)
  
  const isLocal = location && location.kind !== 'national'

  return {
    listings,
    aggregates,
    metadata: {
      provider: 'facebook_marketplace',
      query,
      region_key: regionKey,
      scanned_at: new Date().toISOString(),
      total_listings: listings.length,
      // FB Marketplace is inherently local, so local data is always "available" in concept
      localDataAvailable: isLocal ? true : undefined,
    },
  }
}
