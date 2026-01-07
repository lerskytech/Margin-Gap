import { useEffect, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from './components/system/ErrorBoundary'
import { useAuthStore } from './store/authStore'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { PricingPage } from './pages/PricingPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { Skeleton } from './ui/Skeleton'
import { DevDebugPanel } from './components/system/DevDebugPanel'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { initialized } = useAuthStore()

  if (!initialized) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  // Allow access to dashboard even without auth (for demo purposes)
  // In production, you might want to restrict this
  return <>{children}</>
}

function App() {
  const { initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <Skeleton className="h-32 w-full max-w-md" />
          </div>
        }>
          <Routes>
            <Route 
              path="/login" 
              element={
                <ErrorBoundary>
                  <LoginPage />
                </ErrorBoundary>
              } 
            />
            <Route 
              path="/signup" 
              element={
                <ErrorBoundary>
                  <SignupPage />
                </ErrorBoundary>
              } 
            />
            <Route 
              path="/pricing" 
              element={
                <ErrorBoundary>
                  <PricingPage />
                </ErrorBoundary>
              } 
            />
            <Route 
              path="/auth/callback" 
              element={
                <ErrorBoundary>
                  <AuthCallbackPage />
                </ErrorBoundary>
              } 
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <AppLayout />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            >
              <Route 
                index 
                element={
                  <ErrorBoundary>
                    <DashboardPage />
                  </ErrorBoundary>
                } 
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <DevDebugPanel />
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default App
