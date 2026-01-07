import { supabase, supabaseEnabled } from './supabase'
import type { Profile } from '@/lib/types'

export interface AuthUser {
  id: string
  email: string
  profile?: Profile
}

export const authService = {
  async signUp(email: string, password: string) {
    if (!supabaseEnabled || !supabase) {
      return { user: null, session: null }
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) throw error
    return data
  },

  async signIn(email: string, password: string) {
    if (!supabaseEnabled || !supabase) {
      const error = { code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.' }
      throw error
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  },

  async signInWithGoogle(redirectTo?: string) {
    if (!supabaseEnabled || !supabase) {
      return { url: null }
    }
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        // Capture full error details for debugging
        const debugInfo = {
          status: error.status,
          message: error.message,
          error: (error as any).error,
          error_description: (error as any).error_description,
          error_code: (error as any).error_code,
          name: error.name,
          originalError: error,
        }
        
        // Check if error is due to provider not being enabled
        const errorMessage = error.message?.toLowerCase() || ''
        if (
          errorMessage.includes('unsupported provider') ||
          errorMessage.includes('provider is not enabled') ||
          errorMessage.includes('provider not enabled')
        ) {
          return {
            ok: false,
            error: {
              code: 'OAUTH_PROVIDER_DISABLED',
              message: 'Google provider is not enabled in Supabase.',
              debug: debugInfo,
            },
          } as any
        }
        
        // For other errors, also return structured format with debug
        return {
          ok: false,
          error: {
            code: error.status?.toString() || 'OAUTH_ERROR',
            message: error.message || 'Failed to sign in with Google',
            debug: debugInfo,
          },
        } as any
      }
      return data
    } catch (error: any) {
      // Catch any unexpected errors
      const debugInfo = {
        status: error?.status,
        message: error?.message,
        error: error?.error,
        error_description: error?.error_description,
        error_code: error?.error_code,
        name: error?.name,
        originalError: error,
      }
      return {
        ok: false,
        error: {
          code: error?.status?.toString() || 'OAUTH_ERROR',
          message: error?.message || 'Failed to sign in with Google',
          debug: debugInfo,
        },
      } as any
    }
  },

  async signOut() {
    if (!supabaseEnabled || !supabase) {
      return
    }
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getSession() {
    if (!supabaseEnabled || !supabase) {
      return null
    }
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        // Don't throw for missing sessions - it's a normal signed-out state
        if (error.name === 'AuthSessionMissingError' || error.message?.includes('session missing')) {
          return null
        }
        throw error
      }
      return data.session ?? null
    } catch (error: any) {
      // Catch AuthSessionMissingError and treat as null session
      if (error?.name === 'AuthSessionMissingError' || error?.message?.includes('session missing')) {
        return null
      }
      throw error
    }
  },

  async getUser() {
    if (!supabaseEnabled || !supabase) {
      return null
    }
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        // Don't throw for missing sessions - it's a normal signed-out state
        if (error.name === 'AuthSessionMissingError' || error.message?.includes('session missing')) {
          return null
        }
        throw error
      }
      return data.user ?? null
    } catch (error: any) {
      // Catch AuthSessionMissingError and treat as null user
      if (error?.name === 'AuthSessionMissingError' || error?.message?.includes('session missing')) {
        return null
      }
      throw error
    }
  },

  async getProfile(userId: string): Promise<Profile | null> {
    if (!supabaseEnabled || !supabase) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }
    return data as Profile
  },

  async updateProfile(updates: Partial<Profile>): Promise<Profile | null> {
    if (!supabaseEnabled || !supabase) return null
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw error
    return data as Profile
  },

  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    if (!supabaseEnabled || !supabase) {
      // Return no-op unsubscribe function
      return { data: { subscription: null }, unsubscribe: () => {} }
    }
    return supabase.auth.onAuthStateChange(async (_event: string, session: { user?: { id: string; email?: string } } | null) => {
      if (session?.user) {
        const profile = await authService.getProfile(session.user.id)
        callback({ 
          id: session.user.id, 
          email: session.user.email!,
          profile: profile || undefined,
        })
      } else {
        callback(null)
      }
    })
  },
}
