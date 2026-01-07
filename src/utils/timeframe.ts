/**
 * Timeframe filtering utilities
 */

import type { Timeframe } from '@/lib/types'
import { subDays, subYears } from 'date-fns'

/**
 * Get the start timestamp (in milliseconds) for a timeframe
 * Returns null for 'all' (no cutoff)
 */
export function timeframeStartMs(timeframe: Timeframe, nowMs: number = Date.now()): number | null {
  if (timeframe === 'all') {
    return null
  }

  const now = new Date(nowMs)
  let cutoff: Date

  switch (timeframe) {
    case '7d':
      cutoff = subDays(now, 7)
      break
    case '30d':
      cutoff = subDays(now, 30)
      break
    case '90d':
      cutoff = subDays(now, 90)
      break
    case '180d':
      cutoff = subDays(now, 180)
      break
    case '1y':
      cutoff = subYears(now, 1)
      break
    case '2y':
      cutoff = subYears(now, 2)
      break
    case '5y':
      cutoff = subYears(now, 5)
      break
    default:
      return null
  }

  return cutoff.getTime()
}

/**
 * Filter points by timeframe based on their timestamp in milliseconds
 * Points must have a `ts` property (timestamp in ms) or `date` property (ISO string)
 */
export function filterPointsByTimeframe<T extends { ts?: number; date?: string }>(
  points: T[],
  timeframe: Timeframe,
  nowMs: number = Date.now()
): T[] {
  if (!Array.isArray(points) || points.length === 0) {
    return []
  }

  if (timeframe === 'all') {
    return [...points] // Return new array to ensure reference change
  }

  const startMs = timeframeStartMs(timeframe, nowMs)
  if (startMs === null) {
    return [...points]
  }

  return points.filter(point => {
    let pointMs: number | null = null

    // Prefer ts (timestamp in ms) if available
    if (point.ts !== undefined && typeof point.ts === 'number' && Number.isFinite(point.ts)) {
      pointMs = point.ts
    } else if (point.date) {
      // Parse ISO date string
      try {
        const dateObj = new Date(point.date)
        if (!isNaN(dateObj.getTime())) {
          pointMs = dateObj.getTime()
        }
      } catch {
        // Invalid date, exclude point
        return false
      }
    }

    // Include point if timestamp is >= startMs
    if (pointMs !== null && pointMs >= startMs) {
      return true
    }

    return false
  }).sort((a, b) => {
    // Sort by timestamp ascending
    const tsA = a.ts ?? (a.date ? new Date(a.date).getTime() : 0)
    const tsB = b.ts ?? (b.date ? new Date(b.date).getTime() : 0)
    return tsA - tsB
  })
}

