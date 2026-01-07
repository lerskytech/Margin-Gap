/**
 * Canonical time range model for price trends
 */

export type TimeRangeKey = '7d' | '30d' | '90d' | '180d' | '1y' | '2y' | '5y' | 'all'

export interface TimeRange {
  key: TimeRangeKey
  label: string
  days?: number
  months?: number
  years?: number
  all?: true
}

export const TIME_RANGES: Record<TimeRangeKey, TimeRange> = {
  '7d': { key: '7d', label: '7d', days: 7 },
  '30d': { key: '30d', label: '30d', days: 30 },
  '90d': { key: '90d', label: '90d', days: 90 },
  '180d': { key: '180d', label: '180d', days: 180 },
  '1y': { key: '1y', label: '1y', years: 1 },
  '2y': { key: '2y', label: '2y', years: 2 },
  '5y': { key: '5y', label: '5y', years: 5 },
  'all': { key: 'all', label: 'All', all: true },
}

export const TIME_RANGE_ORDER: TimeRangeKey[] = ['7d', '30d', '90d', '180d', '1y', '2y', '5y', 'all']

/**
 * Convert a time range key to an ISO date string for "since" cutoff
 * Returns null for 'all' (no cutoff)
 */
export function rangeToSinceISO(rangeKey: TimeRangeKey): string | null {
  const range = TIME_RANGES[rangeKey]
  if (range.all) {
    return null // No cutoff for "all"
  }

  const now = new Date()
  let cutoff = new Date(now)

  if (range.days) {
    cutoff.setDate(cutoff.getDate() - range.days)
  } else if (range.months) {
    cutoff.setMonth(cutoff.getMonth() - range.months)
  } else if (range.years) {
    cutoff.setFullYear(cutoff.getFullYear() - range.years)
  }

  return cutoff.toISOString()
}

/**
 * Get the number of days for a time range (for filtering)
 * Returns null for 'all'
 */
export function getTimeRangeDays(rangeKey: TimeRangeKey): number | null {
  const range = TIME_RANGES[rangeKey]
  if (range.all) {
    return null
  }

  if (range.days) {
    return range.days
  } else if (range.months) {
    return range.months * 30 // Approximate
  } else if (range.years) {
    return range.years * 365 // Approximate
  }

  return null
}

