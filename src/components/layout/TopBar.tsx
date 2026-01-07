import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useScanStore } from '@/store/scanStore'
import { googlePlacesService } from '@/services/googlePlaces'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'

export function TopBar() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const { regionKey, setRegionKey, performScan, loading } = useScanStore()
  const [query, setQuery] = useState('')
  const [showLocationMenu, setShowLocationMenu] = useState(false)

  const locations = googlePlacesService.getMockLocations()

  const handleScan = async () => {
    if (!query.trim()) return
    await performScan(query.trim(), user?.id)
  }

  const handleLocationSelect = (loc: { region_key: string; zip?: string; city?: string; state?: string }) => {
    setRegionKey(loc.region_key)
    setShowLocationMenu(false)
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
            <div className="relative">
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowLocationMenu(!showLocationMenu)}
                className="min-w-[120px] justify-between"
              >
                <span>{regionKey === 'US' ? 'National' : locations.find(l => l.region_key === regionKey)?.city || regionKey}</span>
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Button>
              {showLocationMenu && (
                <div className="absolute top-full mt-2 right-0 bg-surface border border-subtle rounded-lg shadow-premium-lg z-10 min-w-[220px] overflow-hidden">
                  <div className="p-2">
                    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">National</div>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-accent rounded-md transition-colors text-sm"
                      onClick={() => handleLocationSelect({ region_key: 'US', zip: undefined, city: undefined, state: undefined })}
                    >
                      United States
                    </button>
                    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-2">Local Markets</div>
                    {locations.map(loc => (
                      <button
                        key={loc.region_key}
                        className="w-full text-left px-3 py-2 hover:bg-accent rounded-md transition-colors text-sm"
                        onClick={() => handleLocationSelect(loc)}
                      >
                        {loc.city}, {loc.state}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
