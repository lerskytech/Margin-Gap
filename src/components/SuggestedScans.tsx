import { useMemo } from 'react'
import { useScanStore } from '@/store/scanStore'
import { useAuthStore } from '@/store/authStore'
import { getSuggestedScans } from '@/lib/productContext'
import { Button } from '@/ui/Button'
import { Card, CardContent } from '@/ui/Card'

interface SuggestedScansProps {
  currentQuery?: string
  onScan?: (query: string) => void
}

export function SuggestedScans({ currentQuery, onScan }: SuggestedScansProps) {
  const { user } = useAuthStore()
  const { performScan } = useScanStore()
  
  const suggestions = useMemo(() => {
    try {
      return currentQuery ? getSuggestedScans(currentQuery) : []
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error generating suggestions:', error)
      }
      return []
    }
  }, [currentQuery])
  
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return null
  }
  
  const handleSuggestionClick = async (query: string) => {
    if (!query || !query.trim()) return
    
    try {
      if (onScan) {
        onScan(query)
      } else {
        await performScan(query.trim(), user?.id)
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error performing suggested scan:', error)
      }
    }
  }
  
  return (
    <Card className="rounded-xl border border-border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-muted-foreground">Related products people track</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              onClick={() => handleSuggestionClick(suggestion)}
              className="text-xs"
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

