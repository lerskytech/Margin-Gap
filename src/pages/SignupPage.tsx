import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'

export function SignupPage() {
  const navigate = useNavigate()
  const { signUp, signInWithGoogle, loading, isEnabled, lastAuthError, clearAuthError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    clearAuthError()

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    try {
      await signUp(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign Up</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={async () => {
                setError(null)
                clearAuthError()
                try {
                  await signInWithGoogle()
                } catch (err) {
                  // Error is already stored in lastAuthError by the store
                }
              }}
              disabled={loading || !isEnabled}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
            {lastAuthError && (
              <>
                <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">
                  {lastAuthError.message}
                </div>
                {import.meta.env.DEV && lastAuthError.debug && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      Debug Info (Dev Only)
                    </summary>
                    <pre className="mt-2 p-2 text-xs bg-muted rounded-md overflow-auto max-h-48">
                      {JSON.stringify(lastAuthError.debug, null, 2)}
                    </pre>
                  </details>
                )}
              </>
            )}
            {!isEnabled && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Auth is disabled — configure Supabase env vars to enable sign-in.
              </p>
            )}
            <div className="text-center text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
