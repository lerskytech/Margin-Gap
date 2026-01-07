import type { ProviderResponse } from '@/lib/types'
import type { LocationMode } from '@/lib/location'
import { generateMockData } from './mockData'

// Mercari provider (stub for future integration)
export async function scanMercari(
  query: string,
  regionKey: string = 'US',
  location?: LocationMode
): Promise<ProviderResponse> {
  // Mock implementation - replace with actual Mercari API integration
  // Mercari is primarily a shipping-based platform, limited local support
  const { listings, aggregates } = generateMockData(query, 'mercari', regionKey)
  
  const isLocal = location && location.kind !== 'national'

  return {
    listings,
    aggregates,
    metadata: {
      provider: 'mercari',
      query,
      region_key: regionKey,
      scanned_at: new Date().toISOString(),
      total_listings: listings.length,
      // Mercari has limited local support
      localDataAvailable: isLocal ? false : undefined,
      ...(isLocal && { 
        providerStatus: 'partial' as const,
        error: { code: 'LOCAL_UNSUPPORTED', message: 'Local filtering not available for Mercari' }
      }),
    },
  }
}
