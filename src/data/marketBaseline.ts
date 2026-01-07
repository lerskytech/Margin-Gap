// Market baseline data for landing page presence
// This establishes authority and demonstrates value without requiring a scan
import type { ScanResult, PriceAggregate, PriceTimeSeriesPoint } from '@/lib/types'

interface BaselineProduct {
  name: string
  category: string
  msrp: number
  nationalUsedAvg: number
  shippableAvg: number
  fairValueRange: { low: number; high: number }
  confidence: number
  lastUpdated: string
  historicalPoints: PriceTimeSeriesPoint[]
}

const baselineProducts: BaselineProduct[] = [
  {
    name: 'iPhone 13',
    category: 'Electronics',
    msrp: 699,
    nationalUsedAvg: 485,
    shippableAvg: 495,
    fairValueRange: { low: 450, high: 520 },
    confidence: 0.87,
    lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    historicalPoints: generateHistoricalPoints(485, 90, 'ebay_active', 'US'),
  },
  {
    name: 'Air Jordan 1 Retro High',
    category: 'Footwear',
    msrp: 170,
    nationalUsedAvg: 145,
    shippableAvg: 152,
    fairValueRange: { low: 130, high: 165 },
    confidence: 0.82,
    lastUpdated: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    historicalPoints: generateHistoricalPoints(145, 90, 'ebay_active', 'US'),
  },
  {
    name: 'PlayStation 5',
    category: 'Gaming',
    msrp: 499,
    nationalUsedAvg: 420,
    shippableAvg: 435,
    fairValueRange: { low: 390, high: 450 },
    confidence: 0.91,
    lastUpdated: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    historicalPoints: generateHistoricalPoints(420, 90, 'ebay_active', 'US'),
  },
  {
    name: 'MacBook Air M1',
    category: 'Computers',
    msrp: 999,
    nationalUsedAvg: 725,
    shippableAvg: 740,
    fairValueRange: { low: 680, high: 780 },
    confidence: 0.89,
    lastUpdated: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    historicalPoints: generateHistoricalPoints(725, 90, 'ebay_active', 'US'),
  },
  {
    name: 'Nintendo Switch OLED',
    category: 'Gaming',
    msrp: 349,
    nationalUsedAvg: 285,
    shippableAvg: 295,
    fairValueRange: { low: 260, high: 310 },
    confidence: 0.85,
    lastUpdated: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    historicalPoints: generateHistoricalPoints(285, 90, 'ebay_active', 'US'),
  },
]

function generateHistoricalPoints(
  basePrice: number,
  days: number,
  sourceType: PriceAggregate['source_type'],
  regionKey: string
): PriceTimeSeriesPoint[] {
  const points: PriceTimeSeriesPoint[] = []
  const now = new Date()
  
  // Generate points for the last N days (every 7 days for 90d = ~13 points)
  const interval = Math.max(1, Math.floor(days / 13))
  
  for (let i = days; i >= 0; i -= interval) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    
    // Add realistic price variation (±5% with slight trend)
    const variation = 1 + (Math.sin(i / 10) * 0.05) + ((Math.random() - 0.5) * 0.03)
    const price = Math.round(basePrice * variation)
    
    points.push({
      date: dateStr,
      avg_price: price,
      sample_size: 25 + Math.floor(Math.random() * 50), // 25-75 samples
      source_type: sourceType,
      region_key: regionKey,
      condition: 'used',
    })
  }
  
  return points
}

export function getBaselineScanResult(productIndex: number = 0): ScanResult {
  const product = baselineProducts[productIndex % baselineProducts.length]
  const today = new Date().toISOString().split('T')[0]
  
  // Build aggregates from baseline data
  const aggregates: PriceAggregate[] = [
    {
      product_id: 'baseline',
      source_type: 'ebay_active',
      region_key: 'US',
      condition: 'used',
      avg_price: product.nationalUsedAvg,
      min_price: product.fairValueRange.low - 20,
      max_price: product.fairValueRange.high + 20,
      median_price: product.nationalUsedAvg,
      sample_size: 45,
      date: today,
    },
    {
      product_id: 'baseline',
      source_type: 'ebay_active',
      region_key: 'US',
      condition: 'used',
      avg_price: product.shippableAvg,
      min_price: product.fairValueRange.low,
      max_price: product.fairValueRange.high,
      median_price: product.shippableAvg,
      sample_size: 38,
      date: today,
    },
    {
      product_id: 'baseline',
      source_type: 'ebay_sold',
      region_key: 'US',
      condition: 'used',
      avg_price: product.nationalUsedAvg - 15,
      min_price: product.fairValueRange.low - 30,
      max_price: product.fairValueRange.high - 10,
      median_price: product.nationalUsedAvg - 15,
      sample_size: 52,
      date: today,
    },
  ]
  
  return {
    scan_id: 'baseline',
    product_id: 'baseline',
    query: product.name,
    region_key: 'US',
    aggregates,
    verdict: {
      status: product.nationalUsedAvg < product.msrp * 0.75 ? 'undervalued' : 'at_market',
      confidence_score: product.confidence,
      fair_value_range: product.fairValueRange,
      current_price: product.nationalUsedAvg,
      delta_percent: ((product.nationalUsedAvg - product.msrp) / product.msrp) * 100,
      margin_estimate: product.nationalUsedAvg - product.msrp,
    },
    scanned_at: product.lastUpdated,
    listings: [], // No listings for baseline
  }
}

export function getBaselineTimeSeries(productIndex: number = 0): PriceTimeSeriesPoint[] {
  const product = baselineProducts[productIndex % baselineProducts.length]
  return product.historicalPoints
}

export function getBaselineProducts() {
  return baselineProducts.map(p => ({
    name: p.name,
    category: p.category,
    msrp: p.msrp,
    nationalUsedAvg: p.nationalUsedAvg,
    shippableAvg: p.shippableAvg,
    fairValueRange: p.fairValueRange,
    confidence: p.confidence,
  }))
}

