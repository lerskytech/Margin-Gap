import { useState, useMemo } from 'react'
import type { Listing } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Badge } from './Badge'
import { formatMoney, formatPct } from '@/lib/presence'

interface ListingsPreviewProps {
  listings?: Listing[]
  referenceAvg?: number // Average price to compare against for "deal" calculation
}

type SortOption = 'lowest_total' | 'lowest_price' | 'best_deal'

export function ListingsPreview({ listings = [], referenceAvg }: ListingsPreviewProps) {
  // Ensure listings is always an array
  const safeListings = Array.isArray(listings) ? listings : []
  const [activeTab, setActiveTab] = useState<'shippable' | 'local'>('shippable')
  const [sortBy, setSortBy] = useState<SortOption>('lowest_total')

  const shippableListings = safeListings.filter(
    l => l && l.shipping_available && l.source_type !== 'facebook_marketplace' && l.source_type !== 'offerup'
  )
  const localListings = safeListings.filter(
    l => l && (!l.shipping_available || l.source_type === 'facebook_marketplace' || l.source_type === 'offerup')
  )

  const displayListings = useMemo(() => {
    const base = activeTab === 'shippable' ? shippableListings : localListings
    
    // Calculate total (price + estimated shipping if available)
    const withTotals = base.map(listing => ({
      ...listing,
      total: listing.price + (listing.shipping_available ? 10 : 0), // Estimate $10 shipping if available
      dealPercent: referenceAvg ? ((listing.price - referenceAvg) / referenceAvg) * 100 : 0,
    }))
    
    // Sort
    const sorted = [...withTotals].sort((a, b) => {
      switch (sortBy) {
        case 'lowest_total':
          return a.total - b.total
        case 'lowest_price':
          return a.price - b.price
        case 'best_deal':
          return a.dealPercent - b.dealPercent // Most negative = best deal
        default:
          return 0
      }
    })
    
    return sorted
  }, [activeTab, shippableListings, localListings, sortBy, referenceAvg])

  const getSourceBadgeVariant = (source: string): 'default' | 'success' | 'secondary' => {
    if (source.includes('ebay')) return 'success'
    if (source.includes('amazon')) return 'default'
    return 'secondary'
  }

  const getDealBadgeVariant = (dealPercent: number): 'success' | 'secondary' | 'warning' => {
    if (dealPercent < -5) return 'success' // Good deal (>5% below avg)
    if (dealPercent > 5) return 'warning' // Overpriced
    return 'secondary' // Neutral
  }

  return (
    <Card variant="elevated">
      <CardHeader className="pb-4 border-b border-subtle">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-xl font-semibold">Top Listings</CardTitle>
          <div className="flex gap-1.5 bg-surface2 p-1 rounded-lg border border-subtle">
            <button
              onClick={() => setActiveTab('shippable')}
              className={`px-3 py-1.5 text-sm rounded-md transition-all font-medium ${
                activeTab === 'shippable'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              Shippable ({shippableListings.length})
            </button>
            <button
              onClick={() => setActiveTab('local')}
              className={`px-3 py-1.5 text-sm rounded-md transition-all font-medium ${
                activeTab === 'local'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              Local / Used ({localListings.length})
            </button>
          </div>
        </div>
        {displayListings.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-xs border border-subtle rounded-md px-2.5 py-1.5 bg-surface hover:border-primary/50 transition-colors"
            >
              <option value="lowest_total">Lowest Total</option>
              <option value="lowest_price">Lowest Price</option>
              <option value="best_deal">Best Deal</option>
            </select>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {displayListings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {activeTab === 'shippable' ? (
              <>
                <p className="text-sm">No shippable listings returned yet.</p>
                <p className="text-xs mt-1">Check provider status in Debug.</p>
              </>
            ) : (
              <>
                <p className="text-sm">No local listings returned yet.</p>
                <p className="text-xs mt-1">Check provider status in Debug.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {displayListings.slice(0, 10).map((listing) => (
              <div
                key={listing.id}
                className="flex items-center justify-between p-4 border border-subtle rounded-lg bg-surface hover:bg-accent/50 hover:border-primary/30 hover:shadow-sm transition-all duration-150"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-medium text-sm truncate">{listing.title}</h4>
                    <Badge variant={getSourceBadgeVariant(listing.source_type)} className="text-xs shrink-0">
                      {listing.source_type.replace('_', ' ')}
                    </Badge>
                    {referenceAvg && Math.abs(listing.dealPercent) > 1 && (
                      <Badge variant={getDealBadgeVariant(listing.dealPercent)} className="text-xs shrink-0">
                        {formatPct(listing.dealPercent)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatMoney(listing.price)}</span>
                    {listing.shipping_available && (
                      <span>+ shipping ({formatMoney(listing.total - listing.price)} est.)</span>
                    )}
                    {listing.condition && <span>• {listing.condition}</span>}
                  </div>
                </div>
                {listing.url ? (
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-4 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shrink-0"
                  >
                    Open
                  </a>
                ) : (
                  <span className="ml-4 px-3 py-1.5 text-xs text-muted-foreground shrink-0">No URL</span>
                )}
              </div>
            ))}
            {displayListings.length > 10 && (
              <div className="text-center text-xs text-muted-foreground pt-2">
                Showing 10 of {displayListings.length} listings
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
