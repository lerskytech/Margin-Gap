import type { ProviderResponse } from '@/lib/types'
import { generateMockData } from './mockData'

// Mercari provider (stub for future integration)
export async function scanMercari(
  query: string,
  regionKey: string = 'US'
): Promise<ProviderResponse> {
  // Mock implementation - replace with actual Mercari API integration
  const { listings, aggregates } = generateMockData(query, 'mercari', regionKey)

  return {
    listings,
    aggregates,
    metadata: {
      provider: 'mercari',
      query,
      region_key: regionKey,
      scanned_at: new Date().toISOString(),
      total_listings: listings.length,
    },
  }
}
