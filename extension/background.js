// Background service worker for MarginGap Chrome Extension
// Handles context menu, message passing, caching, and request deduplication

// Minimal logger utility (inline for service worker)
const DEBUG = false
const logger = {
  info: (...args) => { if (DEBUG) console.log('[MarginGap]', ...args) },
  warn: (...args) => { if (DEBUG) console.warn('[MarginGap]', ...args) },
  error: (...args) => console.error('[MarginGap]', ...args)
}

// Normalize text for cache keys
function normalizeText(text) {
  if (!text || typeof text !== 'string') return ''
  return text.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s-]/g, '')
}

// Generate request ID
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

const CONTEXT_MENU_ID = 'margingap-check-price'
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes
const REQUEST_TIMEOUT = 8000 // 8 seconds

// In-memory cache: Map<normalizedKey, { ts, data, promise }>
const cache = new Map()
const inflightRequests = new Map() // Map<normalizedKey, Promise>

// Initialize context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Check MarginGap',
    contexts: ['selection'],
    documentUrlPatterns: [
      'https://*.facebook.com/*',
      'https://*.amazon.com/*',
      'https://*.craigslist.org/*',
      'http://localhost/*' // For testing
    ]
  })
  
  logger.info('MarginGap extension installed')
})

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID && tab?.id) {
    const selectedText = info.selectionText?.trim()
    
    if (!selectedText) {
      return
    }

    // Send message to content script
    chrome.tabs.sendMessage(tab.id, {
      type: 'CHECK_PRICE',
      query: selectedText,
      pageUrl: tab.url,
      pageTitle: tab.title
    }).catch(err => {
      logger.warn('Error sending message to content script:', err)
    })
  }
})

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCAN_PRODUCT') {
    handleScanRequest(message.query, message.regionKey, message.userId)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => {
        logger.error('Scan request failed:', error)
        sendResponse({ success: false, error: error.message || 'Scan failed' })
      })
    return true // Keep channel open for async response
  }

  if (message.type === 'GET_AUTH_STATE') {
    // Legacy support - use GET_SESSION_STATUS instead
    getSessionStatus()
      .then(state => sendResponse({ success: true, data: state }))
      .catch(error => {
        logger.error('Auth state check failed:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === 'TEST_CONNECTION') {
    testConnection()
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => {
        logger.error('Connection test failed:', error)
        sendResponse({ success: false, error: error.message || 'Connection test failed' })
      })
    return true
  }

  if (message.type === 'GET_CONFIG_STATUS') {
    getConfigStatus()
      .then(status => sendResponse({ success: true, data: status }))
      .catch(error => {
        logger.error('Config status check failed:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === 'SET_AUTH_SESSION') {
    // Store session from web app
    chrome.storage.local.set({ 'supabase.auth.token': message.session })
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        logger.error('Failed to store auth session:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === 'CLEAR_AUTH_SESSION') {
    // Clear session
    chrome.storage.local.remove(['supabase.auth.token'])
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        logger.error('Failed to clear auth session:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === 'SIGN_IN') {
    signIn()
      .then(session => sendResponse({ success: true, data: session }))
      .catch(error => {
        logger.error('Sign in failed:', error)
        sendResponse({ success: false, error: error.message || 'Sign in failed' })
      })
    return true
  }

  if (message.type === 'SIGN_OUT') {
    signOut()
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        logger.error('Sign out failed:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === 'GET_SESSION_STATUS') {
    getSessionStatus()
      .then(status => sendResponse({ success: true, data: status }))
      .catch(error => {
        logger.error('Get session status failed:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === 'CREATE_ALERT') {
    createAlert(message.payload)
      .then(alert => sendResponse({ success: true, data: alert }))
      .catch(error => {
        logger.error('Create alert failed:', error)
        sendResponse({ success: false, error: error.message || 'Failed to create alert', requiresAuth: error.requiresAuth || false })
      })
    return true
  }
})

// Get Supabase config from storage with safe defaults
async function getSupabaseConfig() {
  try {
    const stored = await chrome.storage.sync.get(['supabaseUrl', 'supabaseAnonKey'])
    const url = stored.supabaseUrl?.trim() || ''
    const key = stored.supabaseAnonKey?.trim() || ''
    
    if (!url || !key) {
      throw new Error('Supabase credentials not configured')
    }
    
    // Validate URL format
    try {
      new URL(url)
    } catch {
      throw new Error('Invalid Supabase URL format')
    }
    
    return { url, key }
  } catch (error) {
    logger.warn('Config error:', error)
    throw error
  }
}

// Get config status (for options page)
async function getConfigStatus() {
  try {
    const config = await getSupabaseConfig()
    return { configured: true, url: config.url }
  } catch {
    return { configured: false, url: null }
  }
}

// Legacy getAuthState - now uses getSessionStatus
// Kept for backward compatibility
async function getAuthState() {
  return getSessionStatus()
}

// Test connection to Edge Function
async function testConnection() {
  try {
    const config = await getSupabaseConfig()
    
    // Use a safe test query
    const testQuery = 'iPhone 13'
    const result = await handleScanRequest(testQuery, 'US', null)
    
    return {
      success: true,
      message: 'Connection successful',
      data: result
    }
  } catch (error) {
    throw new Error(error.message || 'Connection test failed')
  }
}

// Handle scan request with caching and deduplication
async function handleScanRequest(query, regionKey = 'US', userId = null) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query is required')
  }

  // Normalize for cache key
  const normalizedQuery = normalizeText(query)
  const cacheKey = `${normalizedQuery}:${regionKey || 'US'}`

  // Check cache first
  const cached = cache.get(cacheKey)
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
    logger.info('Cache hit:', cacheKey)
    return {
      ...cached.data,
      meta: {
        ...(cached.data.meta || {}),
        cacheHit: true
      }
    }
  }

  // Check if request is in-flight
  const inflight = inflightRequests.get(cacheKey)
  if (inflight) {
    logger.info('Deduplicating request:', cacheKey)
    return inflight
  }

  // Create new request
  const requestPromise = performScanRequest(query, regionKey, userId)
    .then(result => {
      // Cache successful result
      cache.set(cacheKey, {
        ts: Date.now(),
        data: result
      })
      
      // Clean up inflight
      inflightRequests.delete(cacheKey)
      
      return result
    })
    .catch(error => {
      // Clean up inflight on error
      inflightRequests.delete(cacheKey)
      throw error
    })

  // Store inflight request
  inflightRequests.set(cacheKey, requestPromise)

  return requestPromise
}

// Perform actual scan request to Edge Function
async function performScanRequest(query, regionKey, userId) {
  const config = await getSupabaseConfig()
  const requestId = generateRequestId()
  
  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  
  try {
    const response = await fetch(`${config.url}/functions/v1/scan-product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.key}`,
        ...(userId && { 'X-User-Id': userId })
      },
      body: JSON.stringify({
        query: query.trim(),
        region_key: regionKey,
        user_id: userId
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = 'Scan failed'
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    
    // Ensure requestId in meta
    if (!data.meta) {
      data.meta = {}
    }
    if (!data.meta.requestId) {
      data.meta.requestId = requestId
    }
    if (!data.meta.generatedAt) {
      data.meta.generatedAt = new Date().toISOString()
    }

    return data
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please try again')
    }
    
    if (error.message) {
      throw error
    }
    
    throw new Error('Network error - please check your connection')
  }
}

// ============================================
// AUTH FUNCTIONS
// ============================================

// Sign in with Google OAuth
async function signIn() {
  try {
    const config = await getSupabaseConfig()
    
    // Generate PKCE challenge
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    const state = generateState()
    
    // Store verifier and state for callback
    await chrome.storage.local.set({
      'oauth.codeVerifier': codeVerifier,
      'oauth.state': state
    })
    
    // Build OAuth URL
    const redirectUri = chrome.identity.getRedirectURL()
    const authUrl = `${config.url}/auth/v1/authorize?` +
      `provider=google&` +
      `redirect_to=${encodeURIComponent(redirectUri)}&` +
      `code_challenge=${codeChallenge}&` +
      `code_challenge_method=S256&` +
      `state=${state}`
    
    // Launch OAuth flow
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    })
    
    if (!responseUrl) {
      throw new Error('OAuth flow cancelled')
    }
    
    // Extract code and state from callback URL
    const url = new URL(responseUrl)
    const code = url.searchParams.get('code')
    const returnedState = url.searchParams.get('state')
    
    if (!code) {
      throw new Error('No authorization code received')
    }
    
    if (returnedState !== state) {
      throw new Error('State mismatch - possible CSRF attack')
    }
    
    // Exchange code for session
    const session = await exchangeCodeForSession(config, code, codeVerifier, redirectUri)
    
    // Store session
    await chrome.storage.local.set({
      'supabase.auth.token': {
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
    })
    
    // Clean up OAuth temp data
    await chrome.storage.local.remove(['oauth.codeVerifier', 'oauth.state'])
    
    return {
      user: session.user,
      email: session.user.email
    }
  } catch (error) {
    // Clean up on error
    await chrome.storage.local.remove(['oauth.codeVerifier', 'oauth.state'])
    throw error
  }
}

// Sign out
async function signOut() {
  try {
    const session = await getSession()
    if (session && session.access_token) {
      const config = await getSupabaseConfig()
      // Call Supabase sign out endpoint
      try {
        await fetch(`${config.url}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': config.key
          }
        })
      } catch (e) {
        // Ignore logout errors
      }
    }
    await chrome.storage.local.remove(['supabase.auth.token'])
    return true
  } catch (error) {
    logger.error('Sign out error:', error)
    throw error
  }
}

// Get current session (with refresh if needed)
async function getSession() {
  try {
    const stored = await chrome.storage.local.get(['supabase.auth.token'])
    const token = stored['supabase.auth.token']
    
    if (!token) return null
    
    // Check if expired (with 5 min buffer)
    const expiresAt = token.expires_at * 1000
    const buffer = 5 * 60 * 1000 // 5 minutes
    if (expiresAt < (Date.now() + buffer)) {
      // Try to refresh
      try {
        const refreshed = await refreshSession(token.refresh_token)
        return refreshed
      } catch (error) {
        logger.warn('Refresh failed, clearing session:', error)
        await chrome.storage.local.remove(['supabase.auth.token'])
        return null
      }
    }
    
    return token
  } catch (error) {
    logger.error('Get session error:', error)
    return null
  }
}

// Get session status for UI
async function getSessionStatus() {
  const session = await getSession()
  return {
    isAuthenticated: !!session,
    email: session?.user?.email || null,
    userId: session?.user?.id || null
  }
}

// Refresh session
async function refreshSession(refreshToken) {
  const config = await getSupabaseConfig()
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': config.key
    },
    body: new URLSearchParams({
      refresh_token: refreshToken
    })
  })
  
  if (!response.ok) {
    throw new Error('Failed to refresh session')
  }
  
  const data = await response.json()
  
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: data.expires_at || (Date.now() / 1000 + data.expires_in),
    expires_in: data.expires_in,
    token_type: data.token_type,
    user: data.user
  }
  
  await chrome.storage.local.set({ 'supabase.auth.token': session })
  return session
}

// Exchange OAuth code for session
async function exchangeCodeForSession(config, code, codeVerifier, redirectUri) {
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': config.key
    },
    body: new URLSearchParams({
      code,
      code_verifier: codeVerifier,
      redirect_to: redirectUri
    })
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange code: ${error}`)
  }
  
  const data = await response.json()
  return data
}

// Generate PKCE code verifier
function generateCodeVerifier() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// Generate PKCE code challenge
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// Generate OAuth state
function generateState() {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// Create alert (requires auth)
async function createAlert(payload) {
  const session = await getSession()
  if (!session || !session.access_token) {
    const error = new Error('Authentication required')
    error.requiresAuth = true
    throw error
  }
  
  const config = await getSupabaseConfig()
  const response = await fetch(`${config.url}/functions/v1/create-alert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': config.key
    },
    body: JSON.stringify(payload)
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = 'Failed to create alert'
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.error || errorMessage
    } catch {
      errorMessage = errorText || errorMessage
    }
    
    if (response.status === 401) {
      const error = new Error(errorMessage)
      error.requiresAuth = true
      throw error
    }
    
    throw new Error(errorMessage)
  }
  
  const data = await response.json()
  return data.alert || data
}

// Update performScanRequest to include auth header if available
async function performScanRequest(query, regionKey, userId) {
  const config = await getSupabaseConfig()
  const requestId = generateRequestId()
  
  // Get session for auth header
  const session = await getSession()
  const authHeader = session?.access_token 
    ? { 'Authorization': `Bearer ${session.access_token}` }
    : {}
  
  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  
  try {
    const response = await fetch(`${config.url}/functions/v1/scan-product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.key,
        ...authHeader,
        ...(userId && { 'X-User-Id': userId })
      },
      body: JSON.stringify({
        query: query.trim(),
        region_key: regionKey,
        user_id: userId || session?.user?.id
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = 'Scan failed'
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    
    // Ensure requestId in meta
    if (!data.meta) {
      data.meta = {}
    }
    if (!data.meta.requestId) {
      data.meta.requestId = requestId
    }
    if (!data.meta.generatedAt) {
      data.meta.generatedAt = new Date().toISOString()
    }

    return data
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please try again')
    }
    
    if (error.message) {
      throw error
    }
    
    throw new Error('Network error - please check your connection')
  }
}

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of cache.entries()) {
    if (now - value.ts > CACHE_TTL) {
      cache.delete(key)
      logger.info('Cache expired:', key)
    }
  }
}, 60000) // Check every minute
