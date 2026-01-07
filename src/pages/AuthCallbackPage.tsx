import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, supabaseEnabled } from '@/services/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/Card'
import { Button } from '@/ui/Button'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!supabaseEnabled || !supabase) {
      setStatus('error')
      setErrorMessage('Auth is not configured. Please configure Supabase environment variables.')
      return
    }

    const handleCallback = async () => {
      try {
        // Get session from URL hash/fragment (Supabase OAuth flow)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          setStatus('error')
          setErrorMessage('Failed to retrieve session. Please try signing in again.')
          return
        }

        if (session) {
          // Session exists, redirect to dashboard
          navigate('/', { replace: true })
          return
        }

        // No session yet, wait briefly for Supabase to finalize
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Retry once
        const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession()
        
        if (retryError) {
          console.error('Retry session error:', retryError)
          setStatus('error')
          setErrorMessage('Failed to retrieve session. Please try signing in again.')
          return
        }

        if (retrySession) {
          navigate('/', { replace: true })
          return
        }

        // Still no session after retry
        setStatus('error')
        setErrorMessage('Authentication failed. Please try signing in again.')
      } catch (error) {
        console.error('Callback error:', error)
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred.')
      }
    }

    handleCallback()
  }, [navigate])

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {errorMessage || 'Failed to complete authentication.'}
            </p>
            <Button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Signing you in...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
          <p className="text-sm text-center text-muted-foreground">
            Please wait while we complete your sign-in.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

