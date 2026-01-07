import { useMemo } from 'react'
import type { ScanResult } from '@/lib/types'
import { inferCategory, extractDataSources } from '@/lib/productContext'
import { Badge } from '@/ui/Badge'

interface ProductContextHeaderProps {
  scanResult: ScanResult
  isBaseline?: boolean
}

export function ProductContextHeader({ scanResult, isBaseline }: ProductContextHeaderProps) {
  const context = useMemo(() => {
    try {
      const query = scanResult?.query || 'Unknown Product'
      const aggregates = Array.isArray(scanResult?.aggregates) ? scanResult.aggregates : []
      const regionKey = scanResult?.region_key || 'US'
      
      const category = inferCategory(query)
      const dataSources = extractDataSources(aggregates)
      const marketScope = regionKey === 'US' ? 'National' : regionKey
      
      return {
        ...category,
        dataSources,
        marketScope,
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error building product context:', error)
      }
      return {
        category: 'General Consumer Product',
        categoryPath: 'General Consumer Product',
        dataSources: [],
        marketScope: 'National',
      }
    }
  }, [scanResult?.query, scanResult?.aggregates, scanResult?.region_key])

  if (isBaseline) {
    return null
  }

  return (
    <div className="bg-surface/50 border border-subtle rounded-lg px-5 py-3.5 mb-6 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-6 text-sm">
        <div className="flex items-center gap-2.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Category:</span>
          <span className="text-foreground font-medium">{context.categoryPath}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Data Sources:</span>
          <div className="flex gap-1.5">
            {context.dataSources.length > 0 ? (
              context.dataSources.map((source, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {source}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">Multiple sources</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Market Scope:</span>
          <span className="text-foreground font-medium">{context.marketScope}</span>
        </div>
      </div>
    </div>
  )
}

