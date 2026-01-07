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
    getAuthState()
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

// Get auth state (check for Supabase session)
async function getAuthState() {
  try {
    const session = await chrome.storage.local.get(['supabase.auth.token'])
    const token = session['supabase.auth.token']
    
    return {
      isAuthenticated: !!token,
      userId: token?.user?.id || null
    }
  } catch (error) {
    logger.warn('Auth state error:', error)
    return { isAuthenticated: false, userId: null }
  }
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
