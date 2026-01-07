import type { ProviderResponse, Listing, PriceAggregate } from '@/lib/types'

// Amazon New provider (stub for future integration)
export async function scanAmazonNew(
  query: string,
  regionKey?: string
): Promise<ProviderResponse> {
  // Mock implementation - replace with actual Amazon API integration
  const mockListings: Listing[] = []
  const mockAggregates: PriceAggregate[] = []

  return {
    listings: mockListings,
    aggregates: mockAggregates,
    metadata: {
      provider: 'amazon_new',
      query,
      region_key: regionKey,
      scanned_at: new Date().toISOString(),
      total_listings: 0,
    },
  }
}
