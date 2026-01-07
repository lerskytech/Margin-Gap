import { useState, FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { emailService } from '@/services/emailService'
import { useAuthStore } from '@/store/authStore'
import type { AlertRule, AlertRuleType, WatchlistItem } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { devError } from '@/lib/devLog'

interface AlertRuleModalProps {
  watchlistItem: WatchlistItem
  onClose: () => void
  onSave?: () => void
}

export function AlertRuleModal({ watchlistItem, onClose, onSave }: AlertRuleModalProps) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [ruleType, setRuleType] = useState<AlertRuleType>('PRICE_BELOW')
  const [threshold, setThreshold] = useState('')
  const [windowDays, setWindowDays] = useState(30)
  const [cooldownHours, setCooldownHours] = useState(24)
  const [enabled, setEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  const createRule = useMutation({
    mutationFn: async (rule: Omit<AlertRule, 'id' | 'created_at'>) => {
      if (!user || !supabase) throw new Error('Not authenticated')
      if (!watchlistItem?.id) throw new Error('Watchlist item is required')
      
      try {
        const { data, error } = await supabase
          .from('alert_rules')
          .insert({
            user_id: user.id,
            watchlist_item_id: watchlistItem.id,
            rule_type: rule.rule_type,
            threshold: rule.threshold,
            window_days: rule.window_days,
            enabled: rule.enabled,
            cooldown_hours: rule.cooldown_hours,
          } as any)
          .select()
          .single()

        if (error) {
          devError('Error creating alert rule:', error)
          throw error
        }
        if (!data) {
          throw new Error('Failed to create alert rule')
        }
        return data as AlertRule
      } catch (error) {
        devError('Failed to create alert rule:', error)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules', user?.id] })
      onSave?.()
      onClose()
    },
    onError: (error) => {
      devError('Create alert rule mutation error:', error)
    },
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const thresholdNum = parseFloat(threshold)
    if (isNaN(thresholdNum) || thresholdNum <= 0) {
      setError('Please enter a valid threshold')
      return
    }

    try {
      await createRule.mutateAsync({
        user_id: user!.id,
        watchlist_item_id: watchlistItem.id,
        rule_type: ruleType,
        threshold: thresholdNum,
        window_days: windowDays,
        enabled,
        cooldown_hours: cooldownHours,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alert rule')
    }
  }

  const handleTestEmail = async () => {
    if (!user?.email) {
      setEmailError('No email address found')
      return
    }

    setEmailError(null)
    const testPrice = watchlistItem.last_price || 100

    try {
      const result = await emailService.sendTestEmail(
        user.email,
        watchlistItem.title,
        testPrice
      )

      if (!result.success) {
        setEmailError(result.error || 'Failed to send test email')
        if (result.errorCode === 'EMAIL_NOT_CONFIGURED') {
          setEmailError('Email delivery is not configured. Please check your Supabase Edge Function settings.')
        }
      } else {
        setEmailError(null)
        alert('Test email sent! Check your inbox.')
      }
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to send test email')
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Set Alert for {watchlistItem.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-2">Alert Type</label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as AlertRuleType)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="PRICE_BELOW">Price below</option>
              <option value="PRICE_ABOVE">Price above</option>
              <option value="PCT_DROP">% drop (over window)</option>
              <option value="PCT_RISE">% rise (over window)</option>
            </select>
          </div>
          <div>
            <label htmlFor="threshold" className="block text-sm font-medium mb-1">
              Threshold {ruleType.includes('PCT') ? '(%)' : '($)'}
            </label>
            <Input
              id="threshold"
              type="number"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              required
              placeholder={ruleType.includes('PCT') ? '5.0' : '100.00'}
            />
          </div>
          <div>
            <label htmlFor="windowDays" className="block text-sm font-medium mb-1">
              Window (days)
            </label>
            <select
              id="windowDays"
              value={windowDays}
              onChange={(e) => setWindowDays(parseInt(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          <div>
            <label htmlFor="cooldownHours" className="block text-sm font-medium mb-1">
              Cooldown (hours)
            </label>
            <Input
              id="cooldownHours"
              type="number"
              value={cooldownHours}
              onChange={(e) => setCooldownHours(parseInt(e.target.value))}
              min={1}
              required
            />
          </div>
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Enable alert</span>
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={createRule.isPending}>
              {createRule.isPending ? 'Creating...' : 'Create Alert'}
            </Button>
            <Button type="button" variant="outline" onClick={handleTestEmail}>
              Send Test Email
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
          {emailError && (
            <div className="p-3 rounded-md bg-yellow-50 text-yellow-800 text-sm">
              {emailError}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

