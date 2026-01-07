// Load historical price points for a product to build timeline
import type { PriceTimeSeriesPoint } from '@/lib/types'
import { supabase } from '@/services/supabase'

export async function loadHistoricalPricePoints(
  productId: string,
  userId?: string
): Promise<PriceTimeSeriesPoint[]> {
  const points: PriceTimeSeriesPoint[] = []

  // Try Supabase first if available
  if (userId && supabase) {
    try {
      const { data, error } = await supabase
        .from('price_points')
        .select('*')
        .eq('product_id', productId)
        .order('date', { ascending: true })

      if (!error && Array.isArray(data)) {
        return data.map(p => ({
          date: p.date,
          avg_price: p.avg_price,
          sample_size: p.sample_size || 0,
          source_type: p.source_type || 'ebay_active',
          region_key: p.region_key || 'US',
          condition: p.condition || undefined,
        }))
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading price points from Supabase:', error)
      }
    }
  }

  // Fallback to localStorage
  try {
    const cache = JSON.parse(localStorage.getItem('scan_cache') || '[]')
    const relevantScans = cache.filter((scan: any) => 
      scan.product?.id === productId || scan.productId === productId
    )

    relevantScans.forEach((scan: any) => {
      const scanDate = scan.scanned_at 
        ? new Date(scan.scanned_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]

      if (Array.isArray(scan.aggregates)) {
        scan.aggregates.forEach((agg: any) => {
          if (agg && typeof agg.avg_price === 'number' && Number.isFinite(agg.avg_price) && agg.sample_size > 0) {
            points.push({
              date: scanDate,
              avg_price: agg.avg_price,
              sample_size: agg.sample_size || 0,
              source_type: agg.source_type || 'ebay_active',
              region_key: agg.region_key || 'US',
              condition: agg.condition || undefined,
            })
          }
        })
      }
    })
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error loading price points from localStorage:', error)
    }
  }

  return points
}

