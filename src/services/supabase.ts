import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseEnabled = !!(supabaseUrl && supabaseAnonKey)

if (!supabaseEnabled) {
  console.warn('Missing Supabase environment variables. App will use mock data only.')
}

export const supabase = supabaseEnabled
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : (null as any) // Type-safe workaround for optional Supabase
