// Auth bridge service - syncs web app session to extension storage
// Called after successful authentication to make session available to extension

// Type declarations for Chrome extension APIs (only available in extension context)
declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (message: any, responseCallback?: (response: any) => void) => void
        lastError?: { message?: string }
        onMessage?: {
          addListener: (callback: (message: any, sender: any, sendResponse: (response: any) => void) => void) => void
        }
      }
      storage?: {
        local?: {
          set: (items: Record<string, any>, callback?: () => void) => void
          get: (keys: string | string[], callback: (items: Record<string, any>) => void) => void
        }
      }
    }
  }
}

export const authBridge = {
  /**
   * Sync current Supabase session to extension storage
   * This allows the extension to know if user is authenticated
   */
  async syncSessionToExtension(): Promise<boolean> {
    try {
      // Check if we're in a browser context (not SSR)
      if (typeof window === 'undefined' || !window.chrome?.runtime?.sendMessage) {
        return false
      }

      const { supabase, supabaseEnabled } = await import('./supabase')
      if (!supabaseEnabled || !supabase) {
        return false
      }

      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        // Clear extension storage if no session
        return new Promise<boolean>((resolve) => {
          try {
            if (!window.chrome?.runtime) {
              resolve(false)
              return
            }
            window.chrome.runtime.sendMessage({
              type: 'CLEAR_AUTH_SESSION'
            }, () => {
              if (window.chrome?.runtime?.lastError) {
                if (import.meta.env.DEV) {
                  console.debug('Extension clear session failed:', window.chrome.runtime.lastError)
                }
              }
              resolve(false)
            })
          } catch {
            resolve(false)
          }
        })
      }

      // Send session to extension
      return new Promise<boolean>((resolve) => {
        try {
          if (!window.chrome?.runtime) {
            resolve(false)
            return
          }
          window.chrome.runtime.sendMessage({
            type: 'SET_AUTH_SESSION',
            session: {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_at: session.expires_at,
              expires_in: session.expires_in,
              token_type: session.token_type,
              user: {
                id: session.user.id,
                email: session.user.email,
                aud: session.user.aud,
                role: session.user.role
              }
            }
          }, (response: any) => {
            if (window.chrome?.runtime?.lastError) {
              // Extension might not be installed or not listening
              if (import.meta.env.DEV) {
                console.debug('Extension auth sync failed (extension may not be installed):', window.chrome.runtime.lastError)
              }
              resolve(false)
            } else {
              resolve(response?.success !== false)
            }
          })
        } catch (error) {
          // Extension might not be installed or not listening
          if (import.meta.env.DEV) {
            console.debug('Extension auth sync failed (extension may not be installed):', error)
          }
          resolve(false)
        }
      })
    } catch (error) {
      console.error('Auth bridge sync error:', error)
      return false
    }
  }
}
