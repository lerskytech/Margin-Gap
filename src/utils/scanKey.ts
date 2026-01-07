// Generate stable scan key for deduplication
import type { ScanResult } from '@/lib/types'
import type { LocationMode } from '@/lib/location'
import { getLocationKey } from '@/lib/location'

export interface ScanKey {
  normalizedQuery: string
  scope: string
  sources: string
  location?: string
}

/**
 * Creates a stable key from scan parameters for deduplication
 * Same query + scope + sources + location = same key
 */
export function makeScanKey(scan: ScanResult, location?: LocationMode): string {
  // Normalize query (lowercase, trim, remove extra spaces)
  const normalizedQuery = (scan.query || '').toLowerCase().trim().replace(/\s+/g, ' ')
  
  // Get scope (region_key)
  const scope = scan.region_key || 'US'
  
  // Get sorted list of source types from aggregates
  const sources = (scan.aggregates || [])
    .map(agg => agg.source_type || 'unknown')
    .filter((v, i, arr) => arr.indexOf(v) === i) // unique
    .sort()
    .join(',')
  
  // Include location in key if provided
  const locationKey = location ? getLocationKey(location) : 'national'
  
  // Create stable key
  return `${normalizedQuery}|${scope}|${sources}|${locationKey}`
}

/**
 * Creates a stable key from scan parameters (without location for backward compat)
 */
export function makeScanKeySimple(scan: ScanResult): string {
  const normalizedQuery = (scan.query || '').toLowerCase().trim().replace(/\s+/g, ' ')
  const scope = scan.region_key || 'US'
  const sources = (scan.aggregates || [])
    .map(agg => agg.source_type || 'unknown')
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort()
    .join(',')
  return `${normalizedQuery}|${scope}|${sources}`
}

/**
 * Get display info for a scan group
 */
export function getScanGroupInfo(scans: ScanResult[]): {
  title: string
  subtitle: string
  count: number
  latestScan: ScanResult
} {
  if (scans.length === 0) {
    throw new Error('Cannot get group info for empty scans array')
  }
  
  // Sort by timestamp, most recent first
  const sorted = [...scans].sort((a, b) => {
    const timeA = new Date(a.scanned_at || 0).getTime()
    const timeB = new Date(b.scanned_at || 0).getTime()
    return timeB - timeA
  })
  
  const latestScan = sorted[0]
  const count = scans.length
  
  // Format relative time
  const timeAgo = getRelativeTime(latestScan.scanned_at || new Date().toISOString())
  
  return {
    title: latestScan.query,
    subtitle: `${latestScan.region_key || 'US'} • ${timeAgo}`,
    count,
    latestScan,
  }
}

function getRelativeTime(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return new Date(timestamp).toLocaleDateString()
}

