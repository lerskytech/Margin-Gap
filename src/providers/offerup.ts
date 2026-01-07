import type { ProviderResponse } from '@/lib/types'
import type { LocationMode } from '@/lib/location'
import { generateMockData } from './mockData'

// OfferUp provider (stub for future integration)
export async function scanOfferUp(
  query: string,
  regionKey: string = 'US',
  location?: LocationMode
): Promise<ProviderResponse> {
  // Mock implementation - replace with actual OfferUp API integration
  // OfferUp is a local marketplace, so it naturally supports location filtering
  const { listings, aggregates } = generateMockData(query, 'offerup', regionKey)
  
  const isLocal = location && location.kind !== 'national'

  return {
    listings,
    aggregates,
    metadata: {
      provider: 'offerup',
      query,
      region_key: regionKey,
      scanned_at: new Date().toISOString(),
      total_listings: listings.length,
      // OfferUp is inherently local
      localDataAvailable: isLocal ? true : undefined,
    },
  }
}
