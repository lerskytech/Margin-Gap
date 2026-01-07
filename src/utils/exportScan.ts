// Export utilities for scan data (CSV/JSON)

import type { ScanResult } from '@/lib/types'

export interface ExportData {
  meta: {
    scanId: string
    query: string
    scope: string
    createdAt: string
    sources: Array<{ name: string; count: number }>
    totalSamples: number
  }
  snapshot: {
    msrp?: number
    nationalUsedAvg?: number
    localAvg?: number
    shippableAvg?: number
    gap?: number
    spread?: number
    confidence: number
    status: string
    fairValueRange: { low: number; high: number }
  }
  listings?: Array<{
    title: string
    price: number
    url?: string
    source: string
    location?: string
    timestamp?: string
  }>
}

export function prepareExportData(scanResult: ScanResult): ExportData {
  const aggregates = scanResult.aggregates || []
  
  // Calculate metrics
  const nationalUsed = aggregates.find(a => 
    a.region_key === 'US' && (a.condition === 'used' || !a.condition)
  )
  const localUsed = aggregates.find(a => 
    a.region_key !== 'US' && (a.condition === 'used' || !a.condition)
  )
  const shippable = aggregates.find(a => 
    a.source_type !== 'facebook_marketplace' && a.source_type !== 'offerup'
  )

  const nationalUsedAvg = nationalUsed?.avg_price || shippable?.avg_price
  const localAvg = localUsed?.avg_price
  const shippableAvg = shippable?.avg_price
  const msrp = scanResult.verdict?.fair_value_range?.high

  const gap = msrp && nationalUsedAvg ? msrp - nationalUsedAvg : undefined
  const spread = scanResult.verdict?.fair_value_range 
    ? scanResult.verdict.fair_value_range.high - scanResult.verdict.fair_value_range.low
    : undefined

  const sources = aggregates.map(agg => ({
    name: agg.source_type || 'unknown',
    count: agg.sample_size || 0
  }))

  const totalSamples = aggregates.reduce((sum, agg) => sum + (agg.sample_size || 0), 0)

  // Prepare listings
  const listings = scanResult.listings?.map(listing => ({
    title: listing.title || 'Unknown',
    price: listing.price || 0,
    url: listing.url,
    source: listing.source_type || 'unknown',
    location: listing.region_key,
    timestamp: listing.listing_date || listing.scraped_at
  }))

  return {
    meta: {
      scanId: scanResult.scan_id,
      query: scanResult.query,
      scope: scanResult.region_key,
      createdAt: scanResult.scanned_at,
      sources,
      totalSamples
    },
    snapshot: {
      msrp,
      nationalUsedAvg,
      localAvg,
      shippableAvg,
      gap,
      spread,
      confidence: scanResult.verdict?.confidence_score || 0,
      status: scanResult.verdict?.status || 'at_market',
      fairValueRange: scanResult.verdict?.fair_value_range || { low: 0, high: 0 }
    },
    listings
  }
}

export function exportAsJSON(data: ExportData, filename?: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `margingap-scan-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportAsCSV(data: ExportData, filename?: string): void {
  const lines: string[] = []
  
  // Meta section
  lines.push('Meta Information')
  lines.push(`Scan ID,${data.meta.scanId}`)
  lines.push(`Query,${data.meta.query}`)
  lines.push(`Scope,${data.meta.scope}`)
  lines.push(`Created At,${data.meta.createdAt}`)
  lines.push(`Total Samples,${data.meta.totalSamples}`)
  lines.push('')
  
  // Sources
  lines.push('Sources')
  lines.push('Source,Count')
  data.meta.sources.forEach(src => {
    lines.push(`${src.name},${src.count}`)
  })
  lines.push('')
  
  // Snapshot
  lines.push('Price Snapshot')
  lines.push('Metric,Value')
  if (data.snapshot.msrp) lines.push(`MSRP,${data.snapshot.msrp}`)
  if (data.snapshot.nationalUsedAvg) lines.push(`National Used Avg,${data.snapshot.nationalUsedAvg}`)
  if (data.snapshot.localAvg) lines.push(`Local Avg,${data.snapshot.localAvg}`)
  if (data.snapshot.shippableAvg) lines.push(`Shippable Avg,${data.snapshot.shippableAvg}`)
  if (data.snapshot.gap) lines.push(`Gap,${data.snapshot.gap}`)
  if (data.snapshot.spread) lines.push(`Spread,${data.snapshot.spread}`)
  lines.push(`Confidence,${data.snapshot.confidence}`)
  lines.push(`Status,${data.snapshot.status}`)
  lines.push(`Fair Value Low,${data.snapshot.fairValueRange.low}`)
  lines.push(`Fair Value High,${data.snapshot.fairValueRange.high}`)
  lines.push('')
  
  // Listings
  if (data.listings && data.listings.length > 0) {
    lines.push('Listings')
    lines.push('Title,Price,Source,Location,URL,Timestamp')
    data.listings.forEach(listing => {
      const title = (listing.title || '').replace(/,/g, ';')
      const url = listing.url || ''
      const location = listing.location || ''
      const timestamp = listing.timestamp || ''
      lines.push(`"${title}",${listing.price},${listing.source},"${location}","${url}","${timestamp}"`)
    })
  }
  
  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `margingap-scan-${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

