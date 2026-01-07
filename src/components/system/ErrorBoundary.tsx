import { Component, ErrorInfo, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { devError } from '@/lib/devLog'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    devError('ErrorBoundary caught error:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleCopyDiagnostics = () => {
    const diagnostics = {
      error: this.state.error?.message || 'Unknown error',
      stack: this.state.error?.stack || '',
      componentStack: this.state.errorInfo?.componentStack || '',
      route: window.location.pathname,
      timestamp: new Date().toISOString(),
    }
    
    try {
      navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2))
      alert('Diagnostics copied to clipboard')
    } catch (e) {
      devError('Failed to copy diagnostics:', e)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <CardTitle>Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                The app hit an error while rendering. Try reloading the page or contact support if the issue persists.
              </p>
              
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground mb-2">
                    Error Details (Dev Only)
                  </summary>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                    {this.state.error.message}
                    {'\n\n'}
                    {this.state.error.stack}
                    {this.state.errorInfo?.componentStack && (
                      <>
                        {'\n\nComponent Stack:\n'}
                        {this.state.errorInfo.componentStack}
                      </>
                    )}
                  </pre>
                </details>
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReload}>
                  Reload
                </Button>
                <Button variant="outline" onClick={this.handleCopyDiagnostics}>
                  Copy Diagnostics
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

