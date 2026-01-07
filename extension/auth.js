// Extension auth utilities - manages Supabase session in chrome.storage.local
// Uses PKCE flow for secure OAuth

const AUTH_STORAGE_KEY = 'supabase.auth.token'
const AUTH_STATE_KEY = 'supabase.auth.state'

// Get stored session
async function getStoredSession() {
  try {
    const result = await chrome.storage.local.get([AUTH_STORAGE_KEY])
    const session = result[AUTH_STORAGE_KEY]
    if (!session) return null
    
    // Check if session is expired
    if (session.expires_at && session.expires_at * 1000 < Date.now()) {
      await clearSession()
      return null
    }
    
    return session
  } catch (error) {
    console.error('[MarginGap] Auth get error:', error)
    return null
  }
}

// Store session
async function storeSession(session) {
  try {
    await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: session })
    return true
  } catch (error) {
    console.error('[MarginGap] Auth store error:', error)
    return false
  }
}

// Clear session
async function clearSession() {
  try {
    await chrome.storage.local.remove([AUTH_STORAGE_KEY, AUTH_STATE_KEY])
    return true
  } catch (error) {
    console.error('[MarginGap] Auth clear error:', error)
    return false
  }
}

// Get auth state (for background.js)
async function getAuthState() {
  const session = await getStoredSession()
  return {
    isAuthenticated: !!session,
    userId: session?.user?.id || null,
    email: session?.user?.email || null
  }
}

// Initiate OAuth sign-in
async function initiateSignIn(supabaseUrl, supabaseAnonKey) {
  try {
    // Generate state for CSRF protection
    const state = crypto.randomUUID()
    await chrome.storage.local.set({ [AUTH_STATE_KEY]: state })
    
    // Build OAuth URL
    const redirectUrl = chrome.identity.getRedirectURL()
    const authUrl = `${supabaseUrl}/auth/v1/authorize?` + new URLSearchParams({
      provider: 'google',
      redirect_to: redirectUrl,
      state: state
    })
    
    // Open auth flow
    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    }, async (callbackUrl) => {
      if (chrome.runtime.lastError) {
        console.error('[MarginGap] Auth error:', chrome.runtime.lastError)
        return
      }
      
      if (!callbackUrl) return
      
      // Extract code from callback
      const url = new URL(callbackUrl)
      const code = url.searchParams.get('code')
      const returnedState = url.searchParams.get('state')
      
      // Verify state
      const storedState = (await chrome.storage.local.get([AUTH_STATE_KEY]))[AUTH_STATE_KEY]
      if (returnedState !== storedState || returnedState !== state) {
        console.error('[MarginGap] State mismatch')
        return
      }
      
      // Exchange code for session
      const tokenResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirectUrl)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apikey': supabaseAnonKey
        }
      })
      
      if (!tokenResponse.ok) {
        console.error('[MarginGap] Token exchange failed')
        return
      }
      
      const tokenData = await tokenResponse.json()
      await storeSession(tokenData)
      
      // Notify background script
      chrome.runtime.sendMessage({ type: 'AUTH_STATE_CHANGED', authenticated: true })
    })
  } catch (error) {
    console.error('[MarginGap] Sign-in error:', error)
  }
}

// Sign out
async function signOut() {
  await clearSession()
  chrome.runtime.sendMessage({ type: 'AUTH_STATE_CHANGED', authenticated: false })
}

// Get Supabase config
async function getSupabaseConfig() {
  try {
    const stored = await chrome.storage.sync.get(['supabaseUrl', 'supabaseAnonKey'])
    const url = stored.supabaseUrl?.trim() || ''
    const key = stored.supabaseAnonKey?.trim() || ''
    
    if (!url || !key) {
      throw new Error('Supabase credentials not configured')
    }
    
    return { url, key }
  } catch (error) {
    throw error
  }
}

// Export for use in content script and background
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getStoredSession,
    storeSession,
    clearSession,
    getAuthState,
    initiateSignIn,
    signOut,
    getSupabaseConfig
  }
}

