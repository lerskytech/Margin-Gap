import { useMemo } from 'react'
import { Badge } from '@/ui/Badge'
import { detectFrontendEnv, detectEdgeReachability, buildProviderBadges } from '@/lib/readiness'
import type { ScanResult } from '@/lib/types'

interface ConfigBannerProps {
  scanResult?: ScanResult
  providerStatuses?: Record<string, { status?: string; error?: string }>
}

export function ConfigBanner({ scanResult, providerStatuses }: ConfigBannerProps) {
  const frontendEnv = useMemo(() => detectFrontendEnv(), [])
  const edgeReachability = useMemo(() => detectEdgeReachability(providerStatuses), [providerStatuses])
  const providerBadges = useMemo(
    () => buildProviderBadges(scanResult?.aggregates, providerStatuses),
    [scanResult?.aggregates, providerStatuses]
  )

  const hasIssues = !frontendEnv.supabaseConfigured || edgeReachability === 'unreachable' || 
    providerBadges.some(b => b.status === 'not_configured')

  if (!hasIssues) {
    return null
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-background border-b border-border">
      <div className="flex items-center gap-2 text-xs">
        <Badge variant={frontendEnv.supabaseConfigured ? 'success' : 'danger'} className="text-xs">
          Supabase: {frontendEnv.supabaseConfigured ? 'OK' : 'Missing'}
        </Badge>
        {frontendEnv.supabaseConfigured && (
          <Badge variant={edgeReachability === 'ok' ? 'success' : 'warning'} className="text-xs">
            Edge: {edgeReachability === 'ok' ? 'OK' : edgeReachability === 'unreachable' ? 'Unreachable' : 'Unknown'}
          </Badge>
        )}
        {providerBadges.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Providers:</span>
            {providerBadges.map((badge) => (
              <Badge
                key={badge.provider}
                variant={badge.status === 'ok' ? 'success' : badge.status === 'error' ? 'warning' : 'danger'}
                className="text-xs"
                title={badge.label}
              >
                {badge.provider.replace('_', ' ')}: {badge.status === 'ok' ? 'OK' : badge.status === 'error' ? 'Error' : 'Not Configured'}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
