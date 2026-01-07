/**
 * Environment variable debugging utility
 * Helps diagnose why Supabase might not be configured
 */

export function debugEnvVars() {
  if (import.meta.env.DEV) {
    console.group('🔍 Environment Variables Debug')
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing')
    console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing')
    console.log('URL value:', import.meta.env.VITE_SUPABASE_URL || '(empty)')
    console.log('Key value (first 20 chars):', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) || '(empty)')
    console.log('All VITE_ vars:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')))
    console.groupEnd()
  }
}

export function getEnvStatus() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  
  return {
    urlPresent: !!url,
    keyPresent: !!key,
    urlValue: url || null,
    keyPreview: key ? `${key.substring(0, 20)}...` : null,
    allViteVars: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')),
  }
}

