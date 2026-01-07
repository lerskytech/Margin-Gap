import { useState, FormEvent } from 'react'
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'

interface ProfileSettingsProps {
  onClose?: () => void
}

export function ProfileSettings({ onClose }: ProfileSettingsProps) {
  const { user, updateProfile, loading } = useAuthStore()
  const [displayName, setDisplayName] = useState(user?.profile?.display_name || '')
  const [phone, setPhone] = useState(user?.profile?.phone || '')
  const [emailOptIn, setEmailOptIn] = useState(user?.profile?.email_opt_in ?? true)
  const [smsOptIn, setSmsOptIn] = useState(user?.profile?.sms_opt_in ?? false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const validatePhone = (phoneValue: string): boolean => {
    if (!phoneValue) return true // Optional field
    // Basic E.164 validation: + followed by 1-15 digits
    const cleaned = phoneValue.replace(/\s|-|\(|\)/g, '')
    return /^\+?[1-9]\d{1,14}$/.test(cleaned)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (phone && !validatePhone(phone)) {
      setError('Please enter a valid phone number (e.g., +1234567890)')
      return
    }

    try {
      await updateProfile({
        display_name: displayName || undefined,
        phone: phone || undefined,
        email_opt_in: emailOptIn,
        sms_opt_in: smsOptIn,
      })
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onClose?.()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-md bg-green-50 text-green-800 text-sm">
              Profile updated successfully!
            </div>
          )}
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium mb-1">
              Display Name
            </label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-1">
              Phone (optional)
            </label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={emailOptIn}
                onChange={(e) => setEmailOptIn(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Email notifications</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={smsOptIn}
                onChange={(e) => setSmsOptIn(e.target.checked)}
                disabled
                className="rounded border-gray-300 opacity-50"
              />
              <span className="text-sm text-muted-foreground">
                SMS notifications <span className="text-xs">(not available yet)</span>
              </span>
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
            {onClose && (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

