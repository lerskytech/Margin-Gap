/**
 * Location types and utilities for Local Mode
 */

// LocationMode represents the user's selected location scope
export type LocationMode =
  | { kind: 'national' }
  | { kind: 'zip'; zip: string; label?: string }
  | { kind: 'city'; city: string; region?: string; label: string }

// Top cities for quick selection (static, no API needed)
export const TOP_CITIES: LocationMode[] = [
  { kind: 'city', city: 'New York', region: 'NY', label: 'New York, NY' },
  { kind: 'city', city: 'Los Angeles', region: 'CA', label: 'Los Angeles, CA' },
  { kind: 'city', city: 'Chicago', region: 'IL', label: 'Chicago, IL' },
  { kind: 'city', city: 'Houston', region: 'TX', label: 'Houston, TX' },
  { kind: 'city', city: 'Phoenix', region: 'AZ', label: 'Phoenix, AZ' },
  { kind: 'city', city: 'Philadelphia', region: 'PA', label: 'Philadelphia, PA' },
  { kind: 'city', city: 'San Antonio', region: 'TX', label: 'San Antonio, TX' },
  { kind: 'city', city: 'San Diego', region: 'CA', label: 'San Diego, CA' },
  { kind: 'city', city: 'Dallas', region: 'TX', label: 'Dallas, TX' },
  { kind: 'city', city: 'San Jose', region: 'CA', label: 'San Jose, CA' },
  { kind: 'city', city: 'Miami', region: 'FL', label: 'Miami, FL' },
  { kind: 'city', city: 'Atlanta', region: 'GA', label: 'Atlanta, GA' },
  { kind: 'city', city: 'Seattle', region: 'WA', label: 'Seattle, WA' },
  { kind: 'city', city: 'Denver', region: 'CO', label: 'Denver, CO' },
  { kind: 'city', city: 'Boston', region: 'MA', label: 'Boston, MA' },
]

// Default location
export const DEFAULT_LOCATION: LocationMode = { kind: 'national' }

/**
 * Get a display label for a location
 */
export function getLocationLabel(mode: LocationMode): string {
  if (mode.kind === 'national') return 'National'
  if (mode.kind === 'zip') return mode.label || mode.zip
  if (mode.kind === 'city') return mode.label
  return 'Unknown'
}

/**
 * Get a short label for compact display
 */
export function getLocationShortLabel(mode: LocationMode): string {
  if (mode.kind === 'national') return 'US'
  if (mode.kind === 'zip') return mode.zip
  if (mode.kind === 'city') {
    // Return "City, ST" format, truncated if needed
    const parts = mode.label.split(',')
    if (parts.length >= 2) {
      const city = parts[0].trim()
      const region = parts[1].trim()
      return city.length > 10 ? `${city.slice(0, 10)}...` : `${city}, ${region}`
    }
    return mode.city
  }
  return '?'
}

/**
 * Generate a stable key for a location (for dedup/caching)
 */
export function getLocationKey(mode: LocationMode): string {
  if (mode.kind === 'national') return 'national'
  if (mode.kind === 'zip') return `zip:${mode.zip}`
  if (mode.kind === 'city') {
    const normalizedCity = mode.city.toLowerCase().replace(/\s+/g, '_')
    const region = mode.region?.toLowerCase() || ''
    return `city:${normalizedCity}:${region}`
  }
  return 'unknown'
}

/**
 * Convert LocationMode to a region_key for API calls
 */
export function locationToRegionKey(mode: LocationMode): string {
  if (mode.kind === 'national') return 'US'
  if (mode.kind === 'zip') return `US:zip:${mode.zip}`
  if (mode.kind === 'city') {
    const normalizedCity = mode.city.replace(/\s+/g, '')
    return `US:${mode.region || ''}:${normalizedCity}`
  }
  return 'US'
}

/**
 * Parse user input into a LocationMode
 * Accepts: "33131", "Miami", "Miami, FL"
 */
export function parseLocationInput(input: string): LocationMode | null {
  if (!input) return null
  
  const trimmed = input.trim()
  
  // Check if it's a ZIP code (5 digits)
  if (/^\d{5}$/.test(trimmed)) {
    return { kind: 'zip', zip: trimmed, label: trimmed }
  }
  
  // Check if it's "City, ST" format
  const cityStateMatch = trimmed.match(/^([a-zA-Z\s]+),\s*([A-Za-z]{2})$/i)
  if (cityStateMatch) {
    const city = cityStateMatch[1].trim()
    const region = cityStateMatch[2].toUpperCase()
    return { kind: 'city', city, region, label: `${city}, ${region}` }
  }
  
  // Check if it's just a city name
  if (/^[a-zA-Z\s]+$/.test(trimmed) && trimmed.length >= 2) {
    // Try to match against top cities
    const matchedCity = TOP_CITIES.find(
      c => c.kind === 'city' && c.city.toLowerCase() === trimmed.toLowerCase()
    )
    if (matchedCity) {
      return matchedCity
    }
    // Return as city without region
    return { kind: 'city', city: trimmed, label: trimmed }
  }
  
  return null
}

/**
 * Check if two locations are equal
 */
export function locationsEqual(a: LocationMode, b: LocationMode): boolean {
  return getLocationKey(a) === getLocationKey(b)
}

/**
 * Serialize location for storage
 */
export function serializeLocation(mode: LocationMode): string {
  return JSON.stringify(mode)
}

/**
 * Deserialize location from storage
 */
export function deserializeLocation(str: string): LocationMode | null {
  try {
    const parsed = JSON.parse(str)
    if (parsed && typeof parsed === 'object' && 'kind' in parsed) {
      if (parsed.kind === 'national') return { kind: 'national' }
      if (parsed.kind === 'zip' && typeof parsed.zip === 'string') {
        return { kind: 'zip', zip: parsed.zip, label: parsed.label }
      }
      if (parsed.kind === 'city' && typeof parsed.city === 'string') {
        return { kind: 'city', city: parsed.city, region: parsed.region, label: parsed.label || parsed.city }
      }
    }
  } catch {
    // Invalid JSON
  }
  return null
}

