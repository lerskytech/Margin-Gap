import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useScanStore } from '@/store/scanStore'
import { useLocationStore } from '@/store/locationStore'
import { getLocationShortLabel } from '@/lib/location'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'

export function TopBar() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const { performScan, loading, setLocation } = useScanStore()
  const { mode: locationMode } = useLocationStore()
  const [query, setQuery] = useState('')

  const handleScan = async () => {
    if (!query.trim()) return
    // Sync location to scan store before scanning
    setLocation(locationMode)
    await performScan(query.trim(), user?.id, locationMode)
  }

  return (
    <div className="border-b border-subtle bg-surface/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-3">
            <div className="relative flex-1 max-w-2xl">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <Input
                type="text"
                placeholder="Search for a product..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                className="pl-11 pr-4"
              />
              {import.meta.env.DEV && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                  ⌘K
                </div>
              )}
            </div>
            {/* Location indicator - compact, read-only in TopBar */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface2 border border-subtle rounded-lg text-sm">
              <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-muted-foreground">{getLocationShortLabel(locationMode)}</span>
            </div>
            <Button
              onClick={handleScan}
              disabled={loading || !query.trim()}
              size="md"
              className="min-w-[100px]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scanning...
                </span>
              ) : (
                'Scan'
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {import.meta.env.DEV && (
              <Button variant="ghost" onClick={() => navigate('/pricing')} size="sm">
                Pricing
              </Button>
            )}
            {user ? (
              <>
                {!import.meta.env.DEV && (
                  <Button variant="ghost" onClick={() => navigate('/pricing')}>
                    Pricing
                  </Button>
                )}
                <div className="text-sm text-muted-foreground">{user.email}</div>
                <Button variant="outline" size="sm" onClick={signOut}>
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/login')}>
                  Sign In
                </Button>
                <Button onClick={() => navigate('/signup')}>
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
