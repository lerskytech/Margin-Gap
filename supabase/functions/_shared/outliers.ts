/**
 * Outlier trimming utilities for Edge Functions
 * Uses IQR and median-based methods for robust price statistics
 */

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
 * Remove outliers using IQR (Interquartile Range) method
 */
function trimOutliersIQR(prices: number[], multiplier: number = 1.5): number[] {
  if (prices.length < 4) {
    return prices
  }

  const sorted = [...prices].sort((a, b) => a - b)
  const { q1, q3 } = calculateQuartiles(sorted)
  const iqr = q3 - q1

  if (iqr === 0) {
    return prices
  }

  const lowerBound = q1 - (multiplier * iqr)
  const upperBound = q3 + (multiplier * iqr)

  return prices.filter(price => price >= lowerBound && price <= upperBound)
}

/**
 * Remove outliers using median-based method (MAD - Median Absolute Deviation)
 */
function trimOutliersMedian(prices: number[], threshold: number = 3): number[] {
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

