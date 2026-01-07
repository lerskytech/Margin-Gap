import { create } from 'zustand'
import { authService, type AuthUser } from '@/services/auth'
import { supabaseEnabled } from '@/services/supabase'
import type { Profile } from '@/lib/types'

interface AuthError {
  message: string
  debug?: any
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  initialized: boolean
  isEnabled: boolean
  lastAuthError: AuthError | null
  setUser: (user: AuthUser | null) => void
  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<void>
  refreshProfile: () => Promise<void>
  clearAuthError: () => void
}

let authStateChangeUnsubscribe: (() => void) | null = null

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,
  isEnabled: supabaseEnabled,
  lastAuthError: null,
  setUser: (user) => set({ user }),
  clearAuthError: () => set({ lastAuthError: null }),
  initialize: async () => {
    // Prevent duplicate initialization
    if (get().initialized) {
      return
    }

    set({ loading: true })

    // If Supabase is not enabled, skip auth initialization
    if (!supabaseEnabled) {
      set({ 
        user: null, 
        initialized: true, 
        loading: false,
        isEnabled: false
      })
      return
    }

    try {
      // Check session first - if no session, user is signed out (normal state)
      const session = await authService.getSession()
      
      if (session) {
        // Session exists, get user and profile
        const user = await authService.getUser()
        if (user) {
          const profile = await authService.getProfile(user.id)
          set({
            user: { id: user.id, email: user.email!, profile: profile || undefined },
            initialized: true,
            loading: false,
            isEnabled: true,
          })
        } else {
          // Session exists but getUser returned null (shouldn't happen, but handle gracefully)
          set({ user: null, initialized: true, loading: false, isEnabled: true })
        }
      } else {
        // No session - user is signed out (normal state, not an error)
        set({ user: null, initialized: true, loading: false, isEnabled: true })
      }

      // Set up auth state change listener (only once)
        if (!authStateChangeUnsubscribe) {
          const subscription = authService.onAuthStateChange(async (user) => {
            set({ user })
            // Sync session to extension if available
            if (user && typeof window !== 'undefined') {
              try {
                const { authBridge } = await import('@/services/authBridge')
                await authBridge.syncSessionToExtension()
              } catch (error) {
                // Extension might not be installed, ignore
                if (import.meta.env.DEV) {
                  console.debug('Extension auth sync skipped:', error)
                }
              }
            }
          })
          authStateChangeUnsubscribe = subscription.unsubscribe || (() => {})
        }
        
        // Initial sync if user exists
        if (get().user && typeof window !== 'undefined') {
          try {
            const { authBridge } = await import('@/services/authBridge')
            await authBridge.syncSessionToExtension()
          } catch (error) {
            // Extension might not be installed, ignore
          }
        }
    } catch (error: any) {
      // Only log unexpected errors, not AuthSessionMissingError
      if (error?.name !== 'AuthSessionMissingError' && !error?.message?.includes('session missing')) {
        console.error('Error initializing auth:', error)
      }
      set({ user: null, initialized: true, loading: false, isEnabled: true })
    }
  },
  signIn: async (email, password) => {
    set({ loading: true })
    try {
      await authService.signIn(email, password)
      const user = await authService.getUser()
      if (user) {
        const profile = await authService.getProfile(user.id)
        set({ 
          user: { id: user.id, email: user.email!, profile: profile || undefined },
          loading: false 
        })
      } else {
        set({ loading: false })
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
  signUp: async (email, password) => {
    set({ loading: true })
    try {
      await authService.signUp(email, password)
      const user = await authService.getUser()
      if (user) {
        const profile = await authService.getProfile(user.id)
        set({ 
          user: { id: user.id, email: user.email!, profile: profile || undefined },
          loading: false 
        })
      } else {
        set({ loading: false })
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
  signInWithGoogle: async () => {
    if (!supabaseEnabled) {
      const error = 'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.'
      set({ loading: false, lastAuthError: { message: error } })
      throw new Error(error)
    }
    set({ loading: true, lastAuthError: null })
    try {
      const result = await authService.signInWithGoogle()
      // Check if result indicates an error
      if (result && typeof result === 'object' && 'ok' in result && result.ok === false && 'error' in result) {
        const errorData = (result as any).error
        set({ 
          loading: false, 
          lastAuthError: {
            message: errorData?.message || 'Failed to sign in with Google',
            debug: errorData?.debug,
          }
        })
        return
      }
      // Note: OAuth redirects, so we don't set loading to false here
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign in with Google'
      set({ loading: false, lastAuthError: { message: errorMessage } })
      throw error
    }
  },
  signOut: async () => {
    set({ loading: true })
    try {
      await authService.signOut()
      set({ user: null, loading: false })
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
  updateProfile: async (updates) => {
    const profile = await authService.updateProfile(updates)
    const currentUser = get().user
    if (currentUser && profile) {
      set({ user: { ...currentUser, profile } })
    }
  },
  refreshProfile: async () => {
    const currentUser = get().user
    if (currentUser) {
      const profile = await authService.getProfile(currentUser.id)
      set({ user: { ...currentUser, profile: profile || undefined } })
    }
  },
}))
