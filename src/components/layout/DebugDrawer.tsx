// Debug drawer component (dev mode only)
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'
import type { ScanResult } from '@/lib/types'

interface DebugDrawerProps {
  scanResult?: ScanResult
  providerStatuses?: Record<string, {
    status?: string
    error?: string
    requestId?: string
  }>
  onOpenProfile?: () => void
  onEvaluateAlerts?: () => void
}

export function DebugDrawer({ scanResult, providerStatuses, onOpenProfile, onEvaluateAlerts }: DebugDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())

  // Only show in dev mode
  if (import.meta.env.PROD) {
    return null
  }

  const toggleError = (provider: string) => {
    const newExpanded = new Set(expandedErrors)
    if (newExpanded.has(provider)) {
      newExpanded.delete(provider)
    } else {
      newExpanded.add(provider)
    }
    setExpandedErrors(newExpanded)
  }

  const copyDiagnostics = () => {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      query: scanResult?.query,
      location: scanResult?.region_key,
      scanId: scanResult?.scan_id,
      aggregates: scanResult?.aggregates.map(a => ({
        source: a.source_type,
        sample_size: a.sample_size,
        avg_price: a.avg_price,
      })),
      providerStatuses,
      errors: Object.entries(providerStatuses || {})
        .filter(([_, status]) => status.error)
        .map(([provider, status]) => ({
          provider,
          error: status.error,
          requestId: status.requestId,
        })),
    }
    navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2))
    alert('Diagnostics copied to clipboard')
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
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
    <div className="fixed bottom-4 right-4 w-96 max-h-[70vh] overflow-auto bg-background border border-border rounded-xl shadow-xl z-50">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Debug Panel</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={copyDiagnostics}
                className="h-7 px-2 text-xs"
              >
                Copy Diagnostics
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 p-0"
              >
                ×
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-xs space-y-4">
          {scanResult && (
            <div>
              <div className="font-semibold mb-2 text-xs">Scan Result</div>
              <div className="space-y-1 text-muted-foreground">
                <div>Query: {scanResult.query}</div>
                <div>Location: {scanResult.region_key}</div>
                <div className="font-mono text-xs">Scan ID: {scanResult.scan_id.substring(0, 8)}...</div>
                <div>Aggregates: {scanResult.aggregates.length}</div>
                {scanResult.aggregates.map((agg, idx) => (
                  <div key={idx} className="pl-2 border-l-2 border-border">
                    {agg.source_type}: {agg.sample_size} samples @ {agg.avg_price?.toFixed(2)}
                  </div>
                ))}
                {scanResult.verdict && (
                  <div>Confidence: {(scanResult.verdict.confidence_score * 100).toFixed(0)}%</div>
                )}
              </div>
            </div>
          )}

          {providerStatuses && Object.keys(providerStatuses).length > 0 && (
            <div>
              <div className="font-semibold mb-2 text-xs">Provider Statuses</div>
              <div className="space-y-2">
                {Object.entries(providerStatuses).map(([provider, status]) => {
                  const isExpanded = expandedErrors.has(provider)
                  const hasError = !!status.error
                  return (
                    <div key={provider} className="border border-border rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium">{provider}</div>
                        <Badge
                          variant={
                            status.status === 'success' ? 'success' :
                            status.status === 'partial' ? 'warning' :
                            'danger'
                          }
                          className="text-xs"
                        >
                          {status.status || 'unknown'}
                        </Badge>
                      </div>
                      {status.requestId && (
                        <div className="text-muted-foreground font-mono text-xs mb-1">
                          ID: {status.requestId.substring(0, 8)}...
                        </div>
                      )}
                      {scanResult?.aggregates.find(a => a.source_type === provider) && (
                        <div className="text-muted-foreground text-xs">
                          Samples: {scanResult.aggregates.find(a => a.source_type === provider)?.sample_size || 0}
                        </div>
                      )}
                      {hasError && (
                        <div className="mt-2">
                          <button
                            onClick={() => toggleError(provider)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            {isExpanded ? 'Hide' : 'Show'} Error
                          </button>
                          {isExpanded && (
                            <div className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs font-mono break-all">
                              {status.error}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(!scanResult && (!providerStatuses || Object.keys(providerStatuses).length === 0)) && (
            <div className="text-muted-foreground text-center py-4">No debug data available</div>
          )}

          <div className="border-t border-border pt-4 space-y-2">
            <div className="font-semibold mb-2 text-xs">Account & Alerts</div>
            {onOpenProfile && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenProfile}
                className="w-full text-xs"
              >
                Profile Settings
              </Button>
            )}
            {onEvaluateAlerts && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEvaluateAlerts}
                className="w-full text-xs"
              >
                Evaluate Alerts Now
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
