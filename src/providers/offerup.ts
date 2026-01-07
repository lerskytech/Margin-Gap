import type { ProviderResponse } from '@/lib/types'
import { generateMockData } from './mockData'

// OfferUp provider (stub for future integration)
export async function scanOfferUp(
  query: string,
  regionKey: string = 'US'
): Promise<ProviderResponse> {
  // Mock implementation - replace with actual OfferUp API integration
  const { listings, aggregates } = generateMockData(query, 'offerup', regionKey)

  return {
    listings,
    aggregates,
    metadata: {
      provider: 'offerup',
      query,
      region_key: regionKey,
      scanned_at: new Date().toISOString(),
      total_listings: listings.length,
    },
  }
}
