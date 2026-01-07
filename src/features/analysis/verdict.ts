import type { PriceAggregate, Verdict } from '@/lib/types'
import { trimOutliersSmart } from '@/lib/utils'

export function calculateVerdict(
  aggregates: PriceAggregate[],
  _msrp?: number,
  currentPrice?: number
): Verdict {
  if (aggregates.length === 0) {
    return {
      status: 'at_market',
      confidence_score: 0,
      fair_value_range: { low: 0, high: 0 },
    }
  }

  // Collect all price points from aggregates (using median as primary, avg as secondary)
  // Median is more robust to outliers than average
  const allPrices: number[] = []
  aggregates.forEach(agg => {
    // Prioritize median price (most robust), but include avg for additional data points
    allPrices.push(agg.median_price)
    if (agg.sample_size >= 5) {
      allPrices.push(agg.avg_price)
    }
  })

  if (allPrices.length === 0) {
    return {
      status: 'at_market',
      confidence_score: 0,
      fair_value_range: { low: 0, high: 0 },
    }
  }

  // Apply outlier trimming to get more accurate fair value range
  const trimmedPrices = trimOutliersSmart(allPrices)
  const pricesToUse = trimmedPrices.length >= Math.max(2, allPrices.length * 0.5)
    ? trimmedPrices
    : allPrices

  pricesToUse.sort((a, b) => a - b)
  
  // Use 25th and 75th percentiles for fair value range (IQR-based)
  const q25Index = Math.floor(pricesToUse.length * 0.25)
  const q75Index = Math.floor(pricesToUse.length * 0.75)
  const fairLow = pricesToUse[q25Index] || pricesToUse[0] || 0
  const fairHigh = pricesToUse[q75Index] || pricesToUse[pricesToUse.length - 1] || 0
  const median = pricesToUse.length % 2 === 0
    ? (pricesToUse[Math.floor(pricesToUse.length / 2) - 1] + pricesToUse[Math.floor(pricesToUse.length / 2)]) / 2
    : pricesToUse[Math.floor(pricesToUse.length / 2)] || 0

  const fairValueRange = {
    low: Math.round(fairLow),
    high: Math.round(fairHigh),
  }

  // Determine status based on current price or median
  const referencePrice = currentPrice || median
  let status: Verdict['status'] = 'at_market'
  let deltaPercent: number | undefined
  let marginEstimate: number | undefined

  if (referencePrice < fairValueRange.low) {
    status = 'undervalued'
    deltaPercent = ((fairValueRange.low - referencePrice) / referencePrice) * 100
    marginEstimate = fairValueRange.low - referencePrice
  } else if (referencePrice > fairValueRange.high) {
    status = 'overpriced'
    deltaPercent = ((referencePrice - fairValueRange.high) / referencePrice) * 100
    marginEstimate = referencePrice - fairValueRange.high
  } else {
    status = 'at_market'
    deltaPercent = 0
    marginEstimate = 0
  }

  // Enhanced confidence scoring with multiple factors
  const totalSampleSize = aggregates.reduce((sum, agg) => sum + agg.sample_size, 0)
  const sourceCount = aggregates.length
  const avgSampleSize = totalSampleSize / sourceCount
  
  // Factor 1: Sample size confidence (0-1)
  // Logarithmic scale: 10 samples = 0.5, 50 = 0.8, 100+ = 1.0
  const sampleConfidence = Math.min(Math.log10(Math.max(avgSampleSize, 1)) / Math.log10(100), 1)
  
  // Factor 2: Source diversity (more sources = higher confidence)
  // 1 source = 0.3, 2 = 0.6, 3+ = 1.0
  const sourceDiversityConfidence = Math.min(sourceCount / 3, 1)
  
  // Factor 3: Price consistency (lower variance = higher confidence)
  const priceStdDev = calculateStdDev(pricesToUse)
  const avgPrice = pricesToUse.reduce((sum, p) => sum + p, 0) / pricesToUse.length
  const cv = avgPrice > 0 ? priceStdDev / avgPrice : 1
  // Coefficient of variation: < 0.1 = excellent, < 0.2 = good, < 0.3 = fair, > 0.3 = poor
  const varianceConfidence = Math.max(0, 1 - Math.min(cv / 0.3, 1))
  
  // Factor 4: Fair value range tightness (tighter range = higher confidence)
  const rangeWidth = fairValueRange.high - fairValueRange.low
  const rangePercent = avgPrice > 0 ? (rangeWidth / avgPrice) : 1
  // Range < 20% = excellent, < 40% = good, < 60% = fair
  const rangeTightnessConfidence = Math.max(0, 1 - Math.min(rangePercent / 0.6, 1))

  // Weighted combination of factors
  // Sample size and source diversity are most important
  const confidence_score = (
    sampleConfidence * 0.35 +
    sourceDiversityConfidence * 0.25 +
    varianceConfidence * 0.25 +
    rangeTightnessConfidence * 0.15
  )

  return {
    status,
    confidence_score: Math.round(confidence_score * 100) / 100,
    fair_value_range: fairValueRange,
    current_price: currentPrice || median,
    delta_percent: deltaPercent,
    margin_estimate: marginEstimate,
  }
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
  const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length
  return Math.sqrt(avgSquaredDiff)
}

export function getConditionAggregates(
  aggregates: PriceAggregate[],
  condition: PriceAggregate['condition']
): PriceAggregate[] {
  return aggregates.filter(agg => agg.condition === condition)
}
