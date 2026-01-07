import { useState, FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { alertsService, type CreateAlertRequest } from '@/services/alertsService'
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'

interface ProductAlertModalProps {
  queryText: string
  onClose: () => void
  onSuccess?: () => void
}

export function ProductAlertModal({ queryText, onClose, onSuccess }: ProductAlertModalProps) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [conditionType, setConditionType] = useState<'gap_above' | 'price_below' | 'price_above' | 'pct_below_msrp' | 'pct_above_msrp'>('gap_above')
  const [conditionValue, setConditionValue] = useState('')
  const [scope, setScope] = useState<'national' | 'local'>('national')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createAlert = useMutation({
    mutationFn: async (request: CreateAlertRequest) => {
      return alertsService.createAlert(request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-alerts', user?.id] })
      onSuccess?.()
      onClose()
    },
    onError: (error: Error) => {
      setError(error.message || 'Failed to create alert')
      setIsSubmitting(false)
    }
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const valueNum = parseFloat(conditionValue)
    if (isNaN(valueNum) || valueNum <= 0) {
      setError('Please enter a valid value')
      setIsSubmitting(false)
      return
    }

    createAlert.mutate({
      query_text: queryText,
      scope,
      condition: {
        type: conditionType,
        value: valueNum
      }
    })
  }

  if (!user) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In Required</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            You need to sign in to create alerts.
          </p>
          <Button onClick={onClose} className="w-full">Close</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Set Alert</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Get notified when prices match your criteria for <strong>{queryText}</strong>
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Alert Condition</label>
            <select
              value={conditionType}
              onChange={(e) => setConditionType(e.target.value as any)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
            >
              <option value="gap_above">Gap above $X (MSRP - Market Price)</option>
              <option value="price_below">Price below $X</option>
              <option value="price_above">Price above $X</option>
              <option value="pct_below_msrp">% below MSRP</option>
              <option value="pct_above_msrp">% above MSRP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Value</label>
            <Input
              type="number"
              step="0.01"
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
              placeholder="Enter threshold value"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'national' | 'local')}
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
            >
              <option value="national">National</option>
              <option value="local">Local</option>
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting || !conditionValue}
            >
              {isSubmitting ? 'Creating...' : 'Create Alert'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

