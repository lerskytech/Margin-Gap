// Content script - Premium popup UI with robust selection handling
// Runs on Facebook Marketplace, Amazon, Craigslist, and generic sites

(function() {
  'use strict'

  // Import utils (inline for content script)
  const DEBUG = false
  const logger = {
    info: (...args) => { if (DEBUG) console.log('[MarginGap]', ...args) },
    warn: (...args) => { if (DEBUG) console.warn('[MarginGap]', ...args) },
    error: (...args) => console.error('[MarginGap]', ...args)
  }

  function normalizeText(text) {
    if (!text || typeof text !== 'string') return ''
    return text.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s-]/g, '')
  }

  function formatRelativeTime(isoString) {
    if (!isoString) return 'just now'
    const now = Date.now()
    const then = new Date(isoString).getTime()
    const diffMs = now - then
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    if (diffSec < 10) return 'just now'
    if (diffSec < 60) return `${diffSec}s ago`
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHour < 24) return `${diffHour}h ago`
    return new Date(isoString).toLocaleDateString()
  }

  // PopupController - manages popup lifecycle
  class PopupController {
    constructor() {
      this.element = null
      this.state = null // loading | loaded | hint | error
      this.dismissTimer = null
      this.dismissTimeout = 12000 // 12 seconds
      this.listeners = []
    }

    createPopup(anchor) {
      this.destroyPopup()
      
      this.element = document.createElement('div')
      this.element.id = 'margingap-popup'
      this.element.className = 'margingap-popup'
      this.element.setAttribute('role', 'status')
      this.element.setAttribute('aria-live', 'polite')
      
      this.positionPopup(anchor)
      document.body.appendChild(this.element)
      
      this.setupDismissHandlers()
      logger.info('Popup created')
    }

    updatePopup(state, data = {}) {
      if (!this.element) return
      
      this.state = state
      this.render(state, data)
      
      // Update aria-live
      if (state === 'loaded') {
        this.element.setAttribute('aria-live', 'off')
      }
    }

    positionPopup(anchor) {
      if (!this.element) return
      
      const popupRect = { width: 320, height: 200 } // Approximate
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      }
      
      // Default position: bottom-right of anchor
      let x = anchor.x + (anchor.width || 0) / 2
      let y = anchor.y + (anchor.height || 0) + 12
      
      // Clamp to viewport
      x = Math.max(16, Math.min(x, viewport.width - popupRect.width - 16))
      y = Math.max(16, Math.min(y, viewport.height - popupRect.height - 16))
      
      // If would overflow bottom, show above
      if (y + popupRect.height > viewport.height - 16) {
        y = anchor.y - popupRect.height - 12
        y = Math.max(16, y)
      }
      
      this.element.style.left = `${x}px`
      this.element.style.top = `${y}px`
    }

    render(state, data) {
      if (!this.element) return
      
      if (state === 'loading') {
        this.renderSkeleton(data.query || '')
      } else if (state === 'hint') {
        this.renderHint(data.message || 'Highlight a product name, not just a price')
      } else if (state === 'error') {
        this.renderError(data.error || 'Unable to check price', data.configError)
      } else if (state === 'loaded') {
        this.renderLoaded(data)
      }
    }

    renderSkeleton(query) {
      this.element.innerHTML = `
        <div class="margingap-popup-content">
          <div class="margingap-accent"></div>
          <div class="margingap-header">
            <div class="margingap-title-skeleton"></div>
            <button class="margingap-close" aria-label="Close">×</button>
          </div>
          <div class="margingap-body">
            <div class="margingap-skeleton-row"></div>
            <div class="margingap-skeleton-row"></div>
            <div class="margingap-skeleton-row"></div>
            <div class="margingap-skeleton-big"></div>
          </div>
        </div>
      `
      this.attachCloseHandler()
    }

    renderHint(message) {
      this.element.innerHTML = `
        <div class="margingap-popup-content">
          <div class="margingap-accent"></div>
          <div class="margingap-header">
            <h3 class="margingap-title">Need Product Name</h3>
            <button class="margingap-close" aria-label="Close">×</button>
          </div>
          <div class="margingap-body">
            <div class="margingap-hint">
              <p>${escapeHtml(message)}</p>
              <p class="margingap-hint-sub">Try highlighting the product title instead of just the price.</p>
            </div>
          </div>
        </div>
      `
      this.attachCloseHandler()
    }

    renderError(errorMessage, isConfigError = false) {
      this.element.innerHTML = `
        <div class="margingap-popup-content">
          <div class="margingap-accent margingap-accent-error"></div>
          <div class="margingap-header">
            <h3 class="margingap-title">Unable to Check Price</h3>
            <button class="margingap-close" aria-label="Close">×</button>
          </div>
          <div class="margingap-body">
            <div class="margingap-error">
              <p class="margingap-error-message">${escapeHtml(errorMessage)}</p>
              ${isConfigError ? `
                <button class="margingap-button" onclick="chrome.runtime.openOptionsPage()">
                  Open Settings
                </button>
              ` : `
                <p class="margingap-error-hint">Try highlighting a clearer product title.</p>
              `}
            </div>
          </div>
        </div>
      `
      this.attachCloseHandler()
    }

    renderLoaded(data) {
      const result = data.data || data
      const query = data.query || result.query || ''
      
      if (!result || !result.verdict) {
        this.renderError('Not enough data. Product may be too ambiguous.')
        return
      }

      const aggregates = result.aggregates || []
      const nationalUsed = aggregates.find(a => 
        a.region_key === 'US' && (a.condition === 'used' || !a.condition)
      )
      const localUsed = aggregates.find(a => 
        a.region_key !== 'US' && (a.condition === 'used' || !a.condition)
      )
      const shippable = aggregates.find(a => 
        a.source_type !== 'facebook_marketplace' && a.source_type !== 'offerup'
      )

      const nationalAvg = nationalUsed?.avg_price || shippable?.avg_price || null
      const localAvg = localUsed?.avg_price || null
      const msrp = result.verdict.fair_value_range?.high || null

      // Try to extract price from query
      const priceMatch = query.match(/\$?([\d,]+\.?\d*)/)
      const currentPrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null

      // Calculate margin gap
      const baseline = nationalAvg || (result.verdict.fair_value_range ? 
        (result.verdict.fair_value_range.low + result.verdict.fair_value_range.high) / 2 : 
        msrp) || 0

      let marginGap = null
      let marginGapPct = null
      let status = result.verdict.status || 'at_market'

      if (baseline > 0 && currentPrice && currentPrice > 0) {
        marginGap = currentPrice - baseline
        marginGapPct = ((marginGap / baseline) * 100)
        
        // Status threshold: 5% or $10, whichever is more relevant
        const thresholdPct = 5
        const thresholdDollar = 10
        const threshold = Math.max(thresholdPct, (thresholdDollar / baseline) * 100)
        
        if (marginGapPct < -threshold) {
          status = 'undervalued'
        } else if (marginGapPct > threshold) {
          status = 'overpriced'
        } else {
          status = 'at_market'
        }
      }

      // Status indicator
      const statusConfig = {
        undervalued: { icon: '▲', label: 'Undervalued', color: '#10b981' },
        overpriced: { icon: '▼', label: 'Overpriced', color: '#ef4444' },
        at_market: { icon: '▬', label: 'At Market', color: '#6b7280' }
      }
      const statusInfo = statusConfig[status] || statusConfig.at_market

      // Provenance
      const provenance = result.provenance || {}
      const totalListings = provenance.totalListings || aggregates.reduce((sum, a) => sum + (a.sample_size || 0), 0)
      const sources = provenance.sources || aggregates.map(a => ({
        name: a.source_type || 'unknown',
        count: a.sample_size || 0
      }))
      const updatedAt = provenance.updatedAt || result.scanned_at || result.meta?.generatedAt

      // Get current location for display
      const locationLabel = data.locationLabel || 'National'
      const isLocal = data.location && data.location.kind !== 'national'
      
      this.element.innerHTML = `
        <div class="margingap-popup-content">
          <div class="margingap-accent" style="background: ${statusInfo.color}"></div>
          <div class="margingap-header">
            <div class="margingap-header-top">
              <h3 class="margingap-title">${escapeHtml(query)}</h3>
              <button class="margingap-close" aria-label="Close">×</button>
            </div>
            <div class="margingap-location-chip" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: ${isLocal ? '#dbeafe' : '#f3f4f6'}; border-radius: 12px; font-size: 10px; color: ${isLocal ? '#1d4ed8' : '#6b7280'}; margin-top: 4px;">
              <svg style="width: 10px; height: 10px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              ${escapeHtml(locationLabel)}
            </div>
          </div>
          <div class="margingap-body">
            ${marginGap !== null && marginGapPct !== null ? `
              <div class="margingap-hero">
                <div class="margingap-hero-label">Margin Gap</div>
                <div class="margingap-hero-value" style="color: ${statusInfo.color}">
                  ${formatCurrency(Math.abs(marginGap))}
                  <span class="margingap-hero-percent">${marginGapPct >= 0 ? '+' : ''}${marginGapPct.toFixed(1)}%</span>
                </div>
                <div class="margingap-status-pill" style="background: ${statusInfo.color}20; color: ${statusInfo.color}; border-color: ${statusInfo.color}40">
                  <span class="margingap-status-icon">${statusInfo.icon}</span>
                  ${statusInfo.label}
                </div>
              </div>
            ` : `
              <div class="margingap-hero">
                <div class="margingap-hero-label">Fair Value Range</div>
                <div class="margingap-hero-value">
                  ${formatCurrency(result.verdict.fair_value_range?.low || 0)} - ${formatCurrency(result.verdict.fair_value_range?.high || 0)}
                </div>
              </div>
            `}
            
            <div class="margingap-metrics">
              ${msrp ? `
                <div class="margingap-metric">
                  <span class="margingap-metric-label">MSRP</span>
                  <span class="margingap-metric-value">${formatCurrency(msrp)}</span>
                </div>
              ` : ''}
              ${nationalAvg ? `
                <div class="margingap-metric">
                  <span class="margingap-metric-label">National Used Avg</span>
                  <span class="margingap-metric-value">${formatCurrency(nationalAvg)}</span>
                </div>
              ` : ''}
              ${localAvg ? `
                <div class="margingap-metric">
                  <span class="margingap-metric-label">Local Avg</span>
                  <span class="margingap-metric-value">${formatCurrency(localAvg)}</span>
                </div>
              ` : ''}
            </div>
            
            ${totalListings > 0 ? `
              <div class="margingap-provenance">
                Based on ${totalListings} listing${totalListings !== 1 ? 's' : ''} across ${sources.length} source${sources.length !== 1 ? 's' : ''} • ${formatRelativeTime(updatedAt)}
              </div>
            ` : `
              <div class="margingap-provenance">
                Limited data available
              </div>
            `}
          </div>
          <div class="margingap-footer">
            <div class="margingap-footer-actions">
              <button class="margingap-button margingap-button-alert" data-query="${escapeHtml(query)}" data-authenticated="false">
                Set Alert
              </button>
              <a href="https://margingap.com" target="_blank" class="margingap-link" rel="noopener">
                View full analysis →
              </a>
            </div>
            <div class="margingap-alert-form" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.1);">
              <div style="margin-bottom: 8px;">
                <label style="display: block; font-size: 11px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Alert Condition</label>
                <select class="margingap-alert-type" style="width: 100%; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; background: white;">
                  <option value="price_below">Price below $X</option>
                  <option value="price_above">Price above $X</option>
                  <option value="pct_below_msrp">% below MSRP</option>
                  <option value="pct_above_msrp">% above MSRP</option>
                </select>
              </div>
              <div style="margin-bottom: 8px;">
                <label style="display: block; font-size: 11px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Threshold Value</label>
                <input type="number" step="0.01" class="margingap-alert-value" placeholder="Enter value" style="width: 100%; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; box-sizing: border-box;">
              </div>
              <div style="display: flex; gap: 6px;">
                <button class="margingap-alert-save" style="flex: 1; padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer;">Save Alert</button>
                <button class="margingap-alert-cancel" style="padding: 6px 12px; background: transparent; color: #6b7280; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; cursor: pointer;">Cancel</button>
              </div>
              <div class="margingap-alert-message" style="display: none; margin-top: 8px; padding: 6px; border-radius: 4px; font-size: 11px;"></div>
            </div>
          </div>
        </div>
      `
      this.attachCloseHandler()
      this.attachAlertHandler(query)
    }

    async attachAlertHandler(query) {
      const alertBtn = this.element?.querySelector('.margingap-button-alert')
      if (!alertBtn) return
      
      const alertForm = this.element?.querySelector('.margingap-alert-form')
      const alertType = this.element?.querySelector('.margingap-alert-type')
      const alertValue = this.element?.querySelector('.margingap-alert-value')
      const alertSave = this.element?.querySelector('.margingap-alert-save')
      const alertCancel = this.element?.querySelector('.margingap-alert-cancel')
      const alertMessage = this.element?.querySelector('.margingap-alert-message')
      
      // Check auth state
      try {
        const authResponse = await chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS' })
        const isAuthenticated = authResponse?.success && authResponse?.data?.isAuthenticated
        
        if (isAuthenticated) {
          alertBtn.setAttribute('data-authenticated', 'true')
          alertBtn.addEventListener('click', () => {
            // Toggle alert form
            if (alertForm) {
              const isVisible = alertForm.style.display !== 'none'
              alertForm.style.display = isVisible ? 'none' : 'block'
              if (!isVisible) {
                alertValue?.focus()
              }
            }
          })
          
          // Handle save
          alertSave?.addEventListener('click', async () => {
            const type = alertType?.value || 'price_below'
            const value = parseFloat(alertValue?.value || '0')
            
            if (!value || value <= 0) {
              if (alertMessage) {
                alertMessage.textContent = 'Please enter a valid threshold value'
                alertMessage.style.display = 'block'
                alertMessage.style.background = '#fee2e2'
                alertMessage.style.color = '#991b1b'
              }
              return
            }
            
            alertSave.disabled = true
            alertSave.textContent = 'Saving...'
            
            try {
              const response = await chrome.runtime.sendMessage({
                type: 'CREATE_ALERT',
                payload: {
                  query_text: query,
                  scope: 'national',
                  condition: {
                    type: type,
                    value: value
                  }
                }
              })
              
              if (response.success) {
                if (alertMessage) {
                  alertMessage.textContent = '✓ Alert enabled'
                  alertMessage.style.display = 'block'
                  alertMessage.style.background = '#d1fae5'
                  alertMessage.style.color = '#065f46'
                }
                
                // Auto-collapse after 1s
                setTimeout(() => {
                  if (alertForm) {
                    alertForm.style.display = 'none'
                  }
                  if (alertMessage) {
                    alertMessage.style.display = 'none'
                  }
                  alertValue.value = ''
                  alertSave.disabled = false
                  alertSave.textContent = 'Save Alert'
                }, 1000)
              } else {
                throw new Error(response.error || 'Failed to create alert')
              }
            } catch (error) {
              if (alertMessage) {
                alertMessage.textContent = error.message || 'Failed to create alert'
                alertMessage.style.display = 'block'
                alertMessage.style.background = '#fee2e2'
                alertMessage.style.color = '#991b1b'
              }
              alertSave.disabled = false
              alertSave.textContent = 'Save Alert'
            }
          })
          
          // Handle cancel
          alertCancel?.addEventListener('click', () => {
            if (alertForm) {
              alertForm.style.display = 'none'
            }
            if (alertValue) {
              alertValue.value = ''
            }
            if (alertMessage) {
              alertMessage.style.display = 'none'
            }
          })
        } else {
          alertBtn.setAttribute('data-authenticated', 'false')
          alertBtn.textContent = 'Sign in to enable alerts'
          alertBtn.addEventListener('click', () => this.handleSignInPrompt())
        }
      } catch (error) {
        console.error('[MarginGap] Auth check error:', error)
        alertBtn.setAttribute('data-authenticated', 'false')
        alertBtn.textContent = 'Sign in to enable alerts'
        alertBtn.addEventListener('click', () => this.handleSignInPrompt())
      }
    }

    handleSignInPrompt() {
      // Open extension options page for sign in
      chrome.runtime.openOptionsPage()
      this.destroyPopup()
    }

    attachCloseHandler() {
      const closeBtn = this.element?.querySelector('.margingap-close')
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.destroyPopup())
      }
    }

    setupDismissHandlers() {
      // ESC key
      const escHandler = (e) => {
        if (e.key === 'Escape' && this.element) {
          this.destroyPopup()
        }
      }
      document.addEventListener('keydown', escHandler)
      this.listeners.push({ type: 'keydown', handler: escHandler })

      // Click outside
      const clickHandler = (e) => {
        if (this.element && !this.element.contains(e.target)) {
          this.destroyPopup()
        }
      }
      setTimeout(() => {
        document.addEventListener('click', clickHandler, true)
        this.listeners.push({ type: 'click', handler: clickHandler, capture: true })
      }, 100)

      // Scroll
      const scrollHandler = () => {
        if (this.element) {
          this.destroyPopup()
        }
      }
      document.addEventListener('scroll', scrollHandler, true)
      this.listeners.push({ type: 'scroll', handler: scrollHandler, capture: true })

      // Auto-dismiss timer
      this.dismissTimer = setTimeout(() => {
        if (this.element) {
          this.destroyPopup()
        }
      }, this.dismissTimeout)
    }

    destroyPopup() {
      if (this.dismissTimer) {
        clearTimeout(this.dismissTimer)
        this.dismissTimer = null
      }

      this.listeners.forEach(({ type, handler, capture }) => {
        document.removeEventListener(type, handler, capture || false)
      })
      this.listeners = []

      if (this.element) {
        this.element.remove()
        this.element = null
      }
      
      this.state = null
      logger.info('Popup destroyed')
    }
  }

  // Smart selection parsing
  function parseSelection(text) {
    if (!text || typeof text !== 'string') {
      return { valid: false, reason: 'No text selected' }
    }

    const trimmed = text.trim()
    if (trimmed.length < 3) {
      return { valid: false, reason: 'Selection too short' }
    }

    // Check if selection is primarily a price/number
    const priceOnlyPattern = /^[\$€£¥]?\s*[\d,]+\.?\d*\s*$/
    if (priceOnlyPattern.test(trimmed)) {
      return { valid: false, reason: 'price_only', message: 'Highlight a product name, not just a price' }
    }

    // Check if it's mostly numbers
    const numbersOnly = trimmed.replace(/[\$€£¥,\s]/g, '')
    if (numbersOnly.length > trimmed.length * 0.7) {
      return { valid: false, reason: 'mostly_numbers', message: 'Highlight a product name, not just a price' }
    }

    return { valid: true, query: trimmed }
  }

  // Get selection anchor
  function getSelectionAnchor() {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return { x: 100, y: 100, width: 0, height: 0 }
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    
    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height
    }
  }

  // Main popup controller instance
  const popup = new PopupController()

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CHECK_PRICE') {
      handlePriceCheck(message.query, message.pageUrl, message.pageTitle)
      sendResponse({ success: true })
    }
    return true
  })

  // Handle price check request
  async function handlePriceCheck(query, pageUrl, pageTitle) {
    try {
      // Parse selection
      const parsed = parseSelection(query)
      if (!parsed.valid) {
        const anchor = getSelectionAnchor()
        popup.createPopup(anchor)
        popup.updatePopup('hint', { message: parsed.message || 'Highlight a product name' })
        return
      }

      // Show loading immediately
      const anchor = getSelectionAnchor()
      popup.createPopup(anchor)
      popup.updatePopup('loading', { query: parsed.query })

      // Get auth state and location in parallel
      const [authState, locationResponse] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS' }),
        chrome.runtime.sendMessage({ type: 'GET_LOCATION' })
      ])
      
      if (!authState.success) {
        throw new Error('Failed to get auth state')
      }
      
      // Get location from storage (synced from web app)
      const location = locationResponse?.success ? locationResponse.data : { kind: 'national' }
      const locationLabel = getLocationLabel(location)

      // Infer region (override with location if set)
      let regionKey = inferRegionFromPage(pageUrl)
      if (location && location.kind !== 'national') {
        regionKey = locationToRegionKey(location)
      }

      // Request scan (background will use stored location)
      const response = await chrome.runtime.sendMessage({
        type: 'SCAN_PRODUCT',
        query: parsed.query,
        regionKey,
        userId: authState.data?.userId || null
      })

      if (!response.success) {
        // Check if it's a config error
        const isConfigError = response.error?.includes('not configured') || 
                             response.error?.includes('credentials')
        popup.updatePopup('error', { error: response.error || 'Failed to get price data', configError: isConfigError })
        return
      }

      // Show loaded state with location info
      popup.updatePopup('loaded', { 
        query: parsed.query, 
        data: response.data,
        location,
        locationLabel
      })
    } catch (error) {
      logger.error('Price check error:', error)
      const isConfigError = error.message?.includes('not configured') || 
                           error.message?.includes('credentials')
      popup.updatePopup('error', { 
        error: error.message || 'Unable to check price. Please try again.',
        configError: isConfigError
      })
    }
  }
  
  // Location helpers for content script
  function getLocationLabel(mode) {
    if (!mode || mode.kind === 'national') return 'National'
    if (mode.kind === 'zip') return mode.label || mode.zip
    if (mode.kind === 'city') return mode.label
    return 'Unknown'
  }
  
  function locationToRegionKey(mode) {
    if (!mode || mode.kind === 'national') return 'US'
    if (mode.kind === 'zip') return `US:zip:${mode.zip}`
    if (mode.kind === 'city') {
      const normalizedCity = mode.city.replace(/\s+/g, '')
      return `US:${mode.region || ''}:${normalizedCity}`
    }
    return 'US'
  }

  // Infer region from page URL
  function inferRegionFromPage(url) {
    if (!url) return 'US'
    
    if (url.includes('facebook.com/marketplace')) {
      return 'US'
    }
    
    if (url.includes('craigslist.org')) {
      const match = url.match(/https?:\/\/([^.]+)\.craigslist\.org/)
      if (match) {
        const city = match[1]
        return city === 'sfbay' ? 'US:CA:SanFrancisco' : 'US'
      }
    }
    
    return 'US'
  }

  // Utility functions
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
})()
