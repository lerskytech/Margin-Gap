// Stable scan key generation for grouping scans by query + scope + sources + location
import type { ScanResult } from './types'
import type { LocationMode } from './location'

/**
 * Compute stable scan_key from query, scope, sources, and location
 * Format: query|scope|sources|location_key
 */
export function computeScanKey(
  query: string,
  scope: 'national' | 'local',
  sources: string[],
  locationKey: string | null
): string {
  const normalizedQuery = query.toLowerCase().trim()
  const sortedSources = [...sources].sort().join(',')
  const location = locationKey || 'none'
  return `${normalizedQuery}|${scope}|${sortedSources}|${location}`
}

/**
 * Compute scan_key from a ScanResult
 */
export function makeScanKey(scan: ScanResult | null, location?: LocationMode): string | null {
  if (!scan || !scan.query) return null
  
  const query = scan.query.toLowerCase().trim()
  const scope = scan.region_key === 'US' ? 'national' : 'local'
  const sources = [...new Set((scan.aggregates || []).map(a => a.source_type).filter(Boolean))].sort()
  
  // Determine location_key from location or region_key
  let locationKey: string | null = null
  if (location) {
    if (location.kind === 'zip') {
      locationKey = `ZIP:${location.zip}`
    } else if (location.kind === 'city') {
      locationKey = `CITY:${location.city},${location.region || ''}`
    } else {
      locationKey = 'US'
    }
  } else if (scan.region_key && scan.region_key !== 'US') {
    if (scan.region_key.includes('zip:')) {
      locationKey = `ZIP:${scan.region_key.split(':')[2]}`
    } else if (scan.region_key.includes(':')) {
      const parts = scan.region_key.split(':')
      locationKey = `CITY:${parts.slice(1).join(',')}`
    } else {
      locationKey = scan.region_key
    }
  } else {
    locationKey = 'US'
  }
  
  return computeScanKey(query, scope, sources, locationKey)
}
