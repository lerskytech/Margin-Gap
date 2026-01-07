import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useWatchlist } from '@/features/watchlist/useWatchlist'
import { useScanStore } from '@/store/scanStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/Card'
import { Skeleton } from '@/ui/Skeleton'
import { formatCurrency } from '@/lib/utils'

export function Sidebar() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { watchlist, isLoading } = useWatchlist(user?.id)
  const { recentScans, selectScan } = useScanStore()

  return (
    <div className="w-64 border-r border-subtle bg-surface/30 p-4 space-y-4">
      <Card variant="elevated">
        <CardHeader className="pb-4 border-b border-subtle">
          <CardTitle className="text-lg font-semibold">Watchlist</CardTitle>
        </CardHeader>
        <CardContent>
          {!user ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              Sign in to save products to your watchlist
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : watchlist.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              No items in watchlist
            </div>
          ) : (
            <div className="space-y-2">
              {watchlist.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  className="w-full text-left p-3 rounded-lg border border-subtle bg-surface hover:bg-accent hover:border-primary/50 hover:shadow-sm transition-all duration-150"
                  onClick={() => {
                    // Navigate to product view
                    navigate(`/product/${item.product_id}`)
                  }}
                >
                  <div className="font-medium text-sm truncate">
                    {(item.product as any)?.name || 'Product'}
                  </div>
                  {item.last_price && (
                    <div className="text-xs text-muted-foreground tabular-nums mt-0.5">
                      {formatCurrency(item.last_price)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card variant="elevated">
        <CardHeader className="pb-4 border-b border-subtle">
          <CardTitle className="text-lg font-semibold">Recent Scans</CardTitle>
        </CardHeader>
        <CardContent>
          {!recentScans || recentScans.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              Recent scans will appear here
            </div>
          ) : (
            <div className="space-y-2">
              {Array.isArray(recentScans) && recentScans.slice(0, 10).map((scan) => {
                if (!scan || !scan.id || !scan.query) return null
                return (
                  <button
                    key={scan.id}
                    className="w-full text-left p-3 rounded-lg border border-subtle bg-surface hover:bg-accent hover:border-primary/50 hover:shadow-sm transition-all duration-150"
                    onClick={() => {
                      if (scan.id) {
                        // Select existing scan - do NOT create a new scan
                        selectScan(scan.id)
                      }
                    }}
                  >
                    <div className="font-medium text-sm truncate">{scan.query}</div>
                    <div className="text-xs text-muted-foreground">
                      {scan.timestamp 
                        ? new Date(scan.timestamp).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Unknown date'}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}