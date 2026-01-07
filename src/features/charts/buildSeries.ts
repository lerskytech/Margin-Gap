import type { PriceTimeSeriesPoint, Timeframe } from '@/lib/types'
import { filterPointsByTimeframe } from '@/utils/timeframe'
import { parseISO, subDays } from 'date-fns'

export interface ChartSeries {
  name: string
  data: Array<{ ts: number; price: number; sampleSize: number; date: string }>
  color: string
  visible: boolean
}

const SERIES_COLORS: Record<string, string> = {
  'local_used': '#3b82f6', // blue
  'national_used': '#8b5cf6', // purple
  'shippable': '#10b981', // green
  'new': '#f59e0b', // amber
  'msrp': '#ef4444', // red
  'category_benchmark': '#6b7280', // gray
}

export function buildChartSeries(
  timeSeries: PriceTimeSeriesPoint[],
  timeframe: Timeframe,
  visibleLines: Set<string>,
  msrp?: number
): ChartSeries[] {
  // Filter data by timeframe using the utility function
  // This ensures proper timestamp-based filtering and returns a new array reference
  const filteredData = filterPointsByTimeframe(timeSeries, timeframe)
  
  // If filtering removed all data but we have points, show the most recent point (fallback)
  // BUT: Only if we're not in 'all' mode (in 'all' mode, empty means truly no data)
  let finalFilteredData: PriceTimeSeriesPoint[]
  if (filteredData.length === 0 && timeSeries.length > 0 && timeframe !== 'all') {
    const sorted = [...timeSeries].sort((a, b) => {
      try {
        const tsA = new Date(a.date).getTime()
        const tsB = new Date(b.date).getTime()
        return tsB - tsA // Most recent first
      } catch {
        return 0
      }
    })
    if (sorted.length > 0) {
      finalFilteredData = [sorted[0]]
    } else {
      finalFilteredData = []
    }
  } else {
    finalFilteredData = filteredData
  }

  // Group by source type and region
  const seriesMap = new Map<string, PriceTimeSeriesPoint[]>()
  
  finalFilteredData.forEach(point => {
    const key = `${point.source_type}:${point.region_key}`
    if (!seriesMap.has(key)) {
      seriesMap.set(key, [])
    }
    seriesMap.get(key)!.push(point)
  })

  // Build series
  const series: ChartSeries[] = []
  
  // Add MSRP line if available
  if (msrp !== undefined && Number.isFinite(msrp) && msrp > 0) {
    const now = new Date()
    // Use unique dates from finalFilteredData or current date
    const dates = finalFilteredData.length > 0 
      ? Array.from(new Set(finalFilteredData.map(p => p.date))).sort()
      : [now.toISOString().split('T')[0]]
    const msrpData = dates.map(date => {
      const dateObj = parseISO(date)
      return {
        ts: dateObj.getTime(),
        date,
        price: msrp,
        sampleSize: 0,
      }
    })
    series.push({
      name: 'MSRP',
      data: msrpData,
      color: SERIES_COLORS['msrp'],
      visible: visibleLines.has('msrp'),
    })
  }

  // Add category benchmark
  const categoryData = finalFilteredData.filter(p => 
    p.source_type === 'category_benchmark' && 
    Number.isFinite(p.avg_price) && 
    p.sample_size > 0
  )
  if (categoryData.length > 0) {
    const benchmarkData = categoryData.map(point => {
      const dateObj = parseISO(point.date)
      return {
        ts: dateObj.getTime(),
        date: point.date,
        price: point.avg_price,
        sampleSize: point.sample_size,
      }
    }).filter(d => Number.isFinite(d.price) && Number.isFinite(d.ts))
    if (benchmarkData.length > 0) {
      series.push({
        name: 'Category Benchmark',
        data: benchmarkData,
        color: SERIES_COLORS['category_benchmark'],
        visible: visibleLines.has('category_benchmark'),
      })
    }
  }

  // Add ebay_sold (sold comps - prioritize this)
  const ebaySold = finalFilteredData.filter(p => 
    p.source_type === 'ebay_sold' && Number.isFinite(p.avg_price) && p.sample_size > 0
  )
  if (ebaySold.length > 0) {
    const soldData = ebaySold.map(point => {
      const dateObj = parseISO(point.date)
      return {
        ts: dateObj.getTime(),
        date: point.date,
        price: point.avg_price,
        sampleSize: point.sample_size,
      }
    }).filter(d => Number.isFinite(d.price) && Number.isFinite(d.ts))
    if (soldData.length > 0) {
      series.push({
        name: 'eBay Sold',
        data: soldData,
        color: SERIES_COLORS['national_used'],
        visible: visibleLines.has('ebay_sold'),
      })
    }
  }

  // Add ebay_active (group by condition if available)
  const ebayActiveNew = finalFilteredData.filter(p => 
    p.source_type === 'ebay_active' && 
    p.condition === 'new' &&
    Number.isFinite(p.avg_price) && 
    p.sample_size > 0
  )
  if (ebayActiveNew.length > 0) {
    const activeNewData = ebayActiveNew.map(point => {
      const dateObj = parseISO(point.date)
      return {
        ts: dateObj.getTime(),
        date: point.date,
        price: point.avg_price,
        sampleSize: point.sample_size,
      }
    }).filter(d => Number.isFinite(d.price) && Number.isFinite(d.ts))
    if (activeNewData.length > 0) {
      series.push({
        name: 'eBay Active (New)',
        data: activeNewData,
        color: '#10b981', // green
        visible: visibleLines.has('ebay_active'),
      })
    }
  }

  const ebayActiveUsed = finalFilteredData.filter(p => 
    p.source_type === 'ebay_active' && 
    (p.condition === 'used' || !p.condition) &&
    Number.isFinite(p.avg_price) && 
    p.sample_size > 0
  )
  if (ebayActiveUsed.length > 0) {
    const activeUsedData = ebayActiveUsed.map(point => {
      const dateObj = parseISO(point.date)
      return {
        ts: dateObj.getTime(),
        date: point.date,
        price: point.avg_price,
        sampleSize: point.sample_size,
      }
    }).filter(d => Number.isFinite(d.price) && Number.isFinite(d.ts))
    if (activeUsedData.length > 0) {
      series.push({
        name: 'eBay Active (Used)',
        data: activeUsedData,
        color: SERIES_COLORS['local_used'],
        visible: visibleLines.has('ebay_active'),
      })
    }
  }

  // Fallback: if no condition-specific ebay_active, use all ebay_active
  if (ebayActiveNew.length === 0 && ebayActiveUsed.length === 0) {
    const ebayActive = finalFilteredData.filter(p => 
      p.source_type === 'ebay_active' && 
      Number.isFinite(p.avg_price) && 
      p.sample_size > 0
    )
    if (ebayActive.length > 0) {
      const activeData = ebayActive.map(point => {
        const dateObj = parseISO(point.date)
        return {
          ts: dateObj.getTime(),
          date: point.date,
          price: point.avg_price,
          sampleSize: point.sample_size,
        }
      }).filter(d => Number.isFinite(d.price) && Number.isFinite(d.ts))
      if (activeData.length > 0) {
        series.push({
          name: 'eBay Active',
          data: activeData,
          color: SERIES_COLORS['local_used'],
          visible: visibleLines.has('ebay_active'),
        })
      }
    }
  }

  // Add local used (facebook_marketplace as proxy for local used)
  const localUsed = finalFilteredData.filter(
    p => p.source_type === 'facebook_marketplace' &&
    (p.condition === 'used' || !p.condition) &&
    Number.isFinite(p.avg_price) &&
    p.sample_size > 0
  )
  if (localUsed.length > 0) {
    const localUsedData = localUsed.map(point => {
      const dateObj = parseISO(point.date)
      return {
        ts: dateObj.getTime(),
        date: point.date,
        price: point.avg_price,
        sampleSize: point.sample_size,
      }
    }).filter(d => Number.isFinite(d.price) && Number.isFinite(d.ts))
    if (localUsedData.length > 0) {
      series.push({
        name: 'Local Used',
        data: localUsedData,
        color: SERIES_COLORS['local_used'],
        visible: visibleLines.has('local_used'),
      })
    }
  }

  // Add national used (ebay_active with US region and used condition)
  const nationalUsed = finalFilteredData.filter(
    p => p.source_type === 'ebay_active' &&
    p.region_key === 'US' && 
    (p.condition === 'used' || !p.condition) &&
    Number.isFinite(p.avg_price) &&
    p.sample_size > 0
  )
  if (nationalUsed.length > 0) {
    const nationalUsedData = nationalUsed.map(point => {
      const dateObj = parseISO(point.date)
      return {
        ts: dateObj.getTime(),
        date: point.date,
        price: point.avg_price,
        sampleSize: point.sample_size,
      }
    }).filter(d => Number.isFinite(d.price) && Number.isFinite(d.ts))
    if (nationalUsedData.length > 0) {
      series.push({
        name: 'National Used',
        data: nationalUsedData,
        color: SERIES_COLORS['national_used'],
        visible: visibleLines.has('national_used'),
      })
    }
  }

  // Add shippable (mercari as proxy for shippable)
  const shippable = finalFilteredData.filter(
    p => p.source_type === 'mercari' &&
    Number.isFinite(p.avg_price) &&
    p.sample_size > 0
  )
  if (shippable.length > 0) {
    const shippableData = shippable.map(point => {
      const dateObj = parseISO(point.date)
      return {
        ts: dateObj.getTime(),
        date: point.date,
        price: point.avg_price,
        sampleSize: point.sample_size,
      }
    }).filter(d => Number.isFinite(d.price) && Number.isFinite(d.ts))
    if (shippableData.length > 0) {
      series.push({
        name: 'Shippable',
        data: shippableData,
        color: SERIES_COLORS['shippable'],
        visible: visibleLines.has('shippable'),
      })
    }
  }

  // Add new (amazon_new for new condition)
  const newData = finalFilteredData.filter(
    p => p.source_type === 'amazon_new' &&
    p.condition === 'new' &&
    Number.isFinite(p.avg_price) &&
    p.sample_size > 0
  )
  if (newData.length > 0) {
    const newDataPoints = newData.map(point => {
      const dateObj = parseISO(point.date)
      return {
        ts: dateObj.getTime(),
        date: point.date,
        price: point.avg_price,
        sampleSize: point.sample_size,
      }
    }).filter(d => Number.isFinite(d.price) && Number.isFinite(d.ts))
    if (newDataPoints.length > 0) {
      series.push({
        name: 'New',
        data: newDataPoints,
        color: SERIES_COLORS['new'],
        visible: visibleLines.has('new'),
      })
    }
  }

  return series
}

export function generateMockTimeSeries(
  _productId: string,
  days: number = 90
): PriceTimeSeriesPoint[] {
  const points: PriceTimeSeriesPoint[] = []
  const basePrice = 450
  const today = new Date()

  for (let i = days; i >= 0; i--) {
    const date = subDays(today, i)
    const dateStr = date.toISOString().split('T')[0]
    
    // Add some price variation over time
    const trend = 1 + (Math.sin(i * 0.1) * 0.1)
    const noise = 0.9 + Math.random() * 0.2
    
    // Local used
    points.push({
      date: dateStr,
      avg_price: Math.round(basePrice * 0.85 * trend * noise),
      sample_size: 15 + Math.floor(Math.random() * 10),
      source_type: 'ebay',
      region_key: 'US:FL:Miami',
      condition: 'used',
    })

    // National used
    points.push({
      date: dateStr,
      avg_price: Math.round(basePrice * 0.9 * trend * noise),
      sample_size: 50 + Math.floor(Math.random() * 30),
      source_type: 'ebay',
      region_key: 'US',
      condition: 'used',
    })

    // Shippable
    points.push({
      date: dateStr,
      avg_price: Math.round(basePrice * 0.88 * trend * noise),
      sample_size: 30 + Math.floor(Math.random() * 20),
      source_type: 'mercari',
      region_key: 'US',
    })

    // New
    points.push({
      date: dateStr,
      avg_price: Math.round(basePrice * 1.15 * trend * noise),
      sample_size: 10 + Math.floor(Math.random() * 5),
      source_type: 'amazon_new',
      region_key: 'US',
      condition: 'new',
    })

    // Category benchmark
    points.push({
      date: dateStr,
      avg_price: Math.round(basePrice * 0.92 * trend * noise),
      sample_size: 100,
      source_type: 'category_benchmark',
      region_key: 'US',
    })
  }

  return points
}
