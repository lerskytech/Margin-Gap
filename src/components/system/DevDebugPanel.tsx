import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useScanStore } from '@/store/scanStore'
import { useLocation } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/Card'
import { Button } from '@/ui/Button'

export function DevDebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const { user, initialized } = useAuthStore()
  const { currentScan, recentScans, error, lastError } = useScanStore()

  // Only show in dev mode
  if (import.meta.env.PROD) {
    return null
  }

  if (!isOpen) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="text-xs shadow-lg"
        >
          Debug
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed top-4 right-4 w-80 max-h-[80vh] overflow-auto bg-background border border-border rounded-xl shadow-xl z-50">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Debug Panel</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-7 w-7 p-0"
            >
              ×
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-xs space-y-3">
          <div>
            <div className="font-semibold mb-1">Route</div>
            <div className="text-muted-foreground font-mono">{location.pathname}</div>
          </div>
          
          <div>
            <div className="font-semibold mb-1">Auth</div>
            <div className="text-muted-foreground">
              Status: {initialized ? (user ? 'Signed in' : 'Signed out') : 'Initializing'}
            </div>
            {user && (
              <div className="text-muted-foreground mt-1">
                User ID: {user.id.substring(0, 8)}...
              </div>
            )}
          </div>

          <div>
            <div className="font-semibold mb-1">Scan State</div>
            <div className="text-muted-foreground">
              Active Scan: {currentScan ? currentScan.scan_id.substring(0, 8) + '...' : 'None'}
            </div>
            <div className="text-muted-foreground">
              Recent Scans: {Array.isArray(recentScans) ? recentScans.length : 0}
            </div>
            {error && (
              <div className="text-red-600 mt-1">
                Error: {error}
              </div>
            )}
            {lastError && (
              <div className="text-red-600 mt-1">
                Last Error: {lastError.message}
              </div>
            )}
          </div>

          {currentScan && (
            <div>
              <div className="font-semibold mb-1">Current Scan</div>
              <div className="text-muted-foreground space-y-1">
                <div>Query: {currentScan.query}</div>
                <div>Aggregates: {Array.isArray(currentScan.aggregates) ? currentScan.aggregates.length : 0}</div>
                <div>Listings: {Array.isArray(currentScan.listings) ? currentScan.listings.length : 0}</div>
                <div>Confidence: {currentScan.verdict?.confidence_score ? (currentScan.verdict.confidence_score * 100).toFixed(0) + '%' : 'N/A'}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

