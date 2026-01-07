// Utility functions

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

import type { TimeRangeKey } from '@/utils/timeRanges'
import { getTimeRangeDays } from '@/utils/timeRanges'

export function getTimeframeDays(timeframe: TimeRangeKey): number | null {
  return getTimeRangeDays(timeframe)
}

/**
 * Calculate quartiles for IQR-based outlier detection
 */
function calculateQuartiles(sortedPrices: number[]): {
  q1: number
  q2: number
  q3: number
} {
  const len = sortedPrices.length
  if (len === 0) return { q1: 0, q2: 0, q3: 0 }
  if (len === 1) {
    const val = sortedPrices[0]
    return { q1: val, q2: val, q3: val }
  }

  // Q2 (median)
  const q2Index = Math.floor(len / 2)
  const q2 = len % 2 === 0
    ? (sortedPrices[q2Index - 1] + sortedPrices[q2Index]) / 2
    : sortedPrices[q2Index]

  // Q1 (median of lower half)
  const lowerHalf = sortedPrices.slice(0, q2Index)
  const q1Index = Math.floor(lowerHalf.length / 2)
  const q1 = lowerHalf.length % 2 === 0 && lowerHalf.length > 0
    ? (lowerHalf[q1Index - 1] + lowerHalf[q1Index]) / 2
    : lowerHalf[q1Index] || q2

  // Q3 (median of upper half)
  const upperHalf = sortedPrices.slice(len % 2 === 0 ? q2Index : q2Index + 1)
  const q3Index = Math.floor(upperHalf.length / 2)
  const q3 = upperHalf.length % 2 === 0 && upperHalf.length > 0
    ? (upperHalf[q3Index - 1] + upperHalf[q3Index]) / 2
    : upperHalf[q3Index] || q2

  return { q1, q2, q3 }
}

/**
 * Remove outliers from price array using IQR (Interquartile Range) method
 * Uses a multiplier of 1.5x IQR for outlier detection
 * Returns filtered prices array
 */
export function trimOutliersIQR(prices: number[], multiplier: number = 1.5): number[] {
  if (prices.length < 4) {
    // Need at least 4 prices for meaningful IQR calculation
    return prices
  }

  const sorted = [...prices].sort((a, b) => a - b)
  const { q1, q3 } = calculateQuartiles(sorted)
  const iqr = q3 - q1

  if (iqr === 0) {
    // All prices are the same, no outliers
    return prices
  }

  const lowerBound = q1 - (multiplier * iqr)
  const upperBound = q3 + (multiplier * iqr)

  return prices.filter(price => price >= lowerBound && price <= upperBound)
}

/**
 * Remove outliers using median-based method (MAD - Median Absolute Deviation)
 * More robust to extreme outliers than IQR
 */
export function trimOutliersMedian(prices: number[], threshold: number = 3): number[] {
  if (prices.length < 3) {
    return prices
  }

  const sorted = [...prices].sort((a, b) => a - b)
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)]

  // Calculate Median Absolute Deviation (MAD)
  const deviations = prices.map(p => Math.abs(p - median))
  const mad = deviations.sort((a, b) => a - b)[Math.floor(deviations.length / 2)] || 1

  // Use modified Z-score: 0.6745 * (x - median) / MAD
  // Filter out values with modified Z-score > threshold
  const modifiedZScoreThreshold = threshold / 0.6745

  return prices.filter(price => {
    const modifiedZScore = Math.abs(price - median) / (mad || 1)
    return modifiedZScore <= modifiedZScoreThreshold
  })
}

/**
 * Smart outlier trimming: uses IQR for normal distributions, falls back to median for extreme cases
 */
export function trimOutliersSmart(prices: number[]): number[] {
  if (prices.length < 4) {
    return prices
  }

  // First pass: IQR method
  const iqrFiltered = trimOutliersIQR(prices, 1.5)
  
  // If IQR removed more than 30% of data, use median method instead
  const removalRate = 1 - (iqrFiltered.length / prices.length)
  if (removalRate > 0.3) {
    return trimOutliersMedian(prices, 3)
  }

  return iqrFiltered
}

/**
 * Check if a listing title suggests it's an accessory, bundle, or unrelated item
 * Returns true if the listing should be EXCLUDED (is accessory/bundle)
 */
export function isAccessoryOrBundle(title: string, query: string): boolean {
  const titleLower = title.toLowerCase()
  const queryLower = query.toLowerCase()
  
  // Extract main product terms from query (remove common words)
  const queryTerms = queryLower
    .split(/\s+/)
    .filter(term => term.length > 2 && !['new', 'used', 'for', 'the', 'and', 'or'].includes(term))
  
  // Accessory indicators
  const accessoryKeywords = [
    'case', 'cover', 'protector', 'screen protector', 'tempered glass',
    'charger', 'cable', 'adapter', 'stand', 'mount', 'holder',
    'stylus', 'pen', 'keyboard', 'mouse', 'dock', 'station',
    'bag', 'sleeve', 'strap', 'grip', 'skin', 'decals',
    'battery', 'power bank', 'wireless charger',
    'lens', 'filter', 'tripod', 'remote',
    'memory card', 'sd card', 'storage',
    'headphones', 'earbuds', 'speaker', 'bluetooth',
    'only', 'parts', 'repair', 'broken', 'for parts',
    'compatible', 'generic', 'replacement'
  ]
  
  // Bundle indicators
  const bundleKeywords = [
    'bundle', 'lot', 'set of', 'pack of', 'multi',
    'with', 'includes', 'comes with', 'plus',
    'accessories', 'extras', 'bonus'
  ]
  
  // Check for accessory keywords
  const hasAccessoryKeyword = accessoryKeywords.some(keyword => 
    titleLower.includes(keyword)
  )
  
  // Check for bundle keywords
  const hasBundleKeyword = bundleKeywords.some(keyword => 
    titleLower.includes(keyword)
  )
  
  // If title contains accessory keyword but doesn't contain main product terms, exclude
  if (hasAccessoryKeyword) {
    const hasMainProduct = queryTerms.some(term => titleLower.includes(term))
    if (!hasMainProduct) {
      return true
    }
    
    // Even if it has main product, if it's clearly just an accessory, exclude
    // e.g., "iPhone 13 case" when searching for "iPhone 13"
    const accessoryOnlyPattern = new RegExp(
      `(${queryTerms.join('|')})\\s+(${accessoryKeywords.join('|')})`,
      'i'
    )
    if (accessoryOnlyPattern.test(titleLower)) {
      return true
    }
  }
  
  // Check for bundle patterns - if it's a bundle and price seems too high, might be legitimate
  // But if it's clearly a bundle of accessories, exclude
  if (hasBundleKeyword) {
    // Check if it's a bundle of the actual product (legitimate) vs accessories
    const isProductBundle = queryTerms.some(term => {
      const termPattern = new RegExp(`\\b${term}\\b`, 'i')
      return termPattern.test(titleLower)
    })
    
    // If bundle keyword appears but no main product, likely accessory bundle
    if (!isProductBundle) {
      return true
    }
  }
  
  // Check for "for parts" or "broken" - exclude unless explicitly searching for parts
  if (titleLower.includes('for parts') || titleLower.includes('broken') || titleLower.includes('not working')) {
    if (!queryLower.includes('parts') && !queryLower.includes('broken')) {
      return true
    }
  }
  
  // Check for "only" pattern (e.g., "box only", "charger only")
  if (titleLower.match(/\b(only|just)\b/)) {
    const hasMainProduct = queryTerms.some(term => titleLower.includes(term))
    if (!hasMainProduct) {
      return true
    }
  }
  
  return false
}
