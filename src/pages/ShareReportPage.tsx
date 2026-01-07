// Share Report Page - Public view of shared scan
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ProductIntelligencePanel } from '@/ui/ProductIntelligencePanel'
import { Card, CardContent } from '@/ui/Card'
import { Skeleton } from '@/ui/Skeleton'
import { supabase } from '@/services/supabase'
import type { ScanResult, Timeframe } from '@/lib/types'

export function ShareReportPage() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [timeframe, setTimeframe] = useState<Timeframe>('90d')

  useEffect(() => {
    if (!token) {
      setError('Invalid share link')
      setLoading(false)
      return
    }

    async function fetchShare() {
      try {
        if (!supabase) {
          setError('Service unavailable')
          setLoading(false)
          return
        }

        const { data, error: fetchError } = await supabase.functions.invoke('get-share', {
          body: { token }
        })

        if (fetchError || !data?.payload) {
          setError('Share not found or expired')
          setLoading(false)
          return
        }

        // Reconstruct ScanResult from payload
        const payload = data.payload
        const result: ScanResult = {
          scan_id: payload.meta?.scanId || `shared-${token}`,
          product_id: '', // Not needed for display
          query: payload.meta?.query || data.query || 'Unknown',
          region_key: payload.meta?.scope || 'US',
          aggregates: [], // Will reconstruct from snapshot if needed
          verdict: {
            status: payload.snapshot?.status || 'at_market',
            confidence_score: payload.snapshot?.confidence || 0,
            fair_value_range: payload.snapshot?.fairValueRange || { low: 0, high: 0 }
          },
          scanned_at: payload.meta?.createdAt || new Date().toISOString(),
          listings: payload.listings?.map((l: any) => ({
            id: `shared-${l.title}-${l.price}`,
            product_id: '',
            source_type: l.source as any,
            source_id: '',
            title: l.title,
            price: l.price,
            condition: 'used' as const,
            url: l.url,
            region_key: l.location,
            shipping_available: true,
            pickup_available: false,
            listing_date: l.timestamp || new Date().toISOString(),
            scraped_at: l.timestamp || new Date().toISOString()
          }))
        }

        setScanResult(result)
        setLoading(false)
      } catch (err) {
        console.error('Fetch share error:', err)
        setError('Failed to load share')
        setLoading(false)
      }
    }

    fetchShare()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen p-3 sm:p-6 lg:p-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (error || !scanResult) {
    return (
      <div className="min-h-screen p-3 sm:p-6 lg:p-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <div className="text-red-600 font-medium mb-2">{error || 'Share not found'}</div>
              <p className="text-sm text-muted-foreground">
                This share link may have expired or been deleted.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Shared Price Report</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View-only report for: <strong>{scanResult.query}</strong>
          </p>
        </div>
        <ProductIntelligencePanel
          scanResult={scanResult}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          isBaseline={false}
          isAuthenticated={false}
        />
      </div>
    </div>
  )
}

