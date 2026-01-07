// Options page script with validation and test connection

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settings-form')
  const status = document.getElementById('status')
  const urlInput = document.getElementById('supabase-url')
  const keyInput = document.getElementById('supabase-key')
  const testButton = document.getElementById('test-button')
  const configStatus = document.getElementById('config-status')

  // Load saved settings
  loadSettings()

  // Validate inputs on change
  urlInput.addEventListener('input', () => validateInputs())
  keyInput.addEventListener('input', () => validateInputs())

  // Handle form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    await saveSettings()
  })

  // Handle test connection
  testButton.addEventListener('click', async (e) => {
    e.preventDefault()
    await testConnection()
  })

  // Load settings
  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['supabaseUrl', 'supabaseAnonKey'])
      if (result.supabaseUrl) {
        urlInput.value = result.supabaseUrl
      }
      if (result.supabaseAnonKey) {
        keyInput.value = result.supabaseAnonKey
      }
      
      // Check config status
      await updateConfigStatus()
      validateInputs()
    } catch (error) {
      showStatus('Failed to load settings: ' + error.message, 'error')
    }
  }

  // Update config status display
  async function updateConfigStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG_STATUS' })
      if (response.success && response.data.configured) {
        configStatus.textContent = '✓ Configured'
        configStatus.className = 'config-status configured'
      } else {
        configStatus.textContent = 'Not configured'
        configStatus.className = 'config-status'
      }
    } catch (error) {
      configStatus.textContent = 'Unknown'
      configStatus.className = 'config-status'
    }
  }

  // Validate inputs
  function validateInputs() {
    const url = urlInput.value.trim()
    const key = keyInput.value.trim()
    
    let urlValid = false
    let keyValid = false

    // Validate URL
    if (url) {
      try {
        const urlObj = new URL(url)
        urlValid = urlObj.protocol === 'https:' && urlObj.hostname.includes('supabase')
        urlInput.style.borderColor = urlValid ? '#10b981' : '#ef4444'
      } catch {
        urlInput.style.borderColor = url ? '#ef4444' : '#d1d5db'
      }
    } else {
      urlInput.style.borderColor = '#d1d5db'
    }

    // Validate key (basic format check - JWT-like)
    if (key) {
      keyValid = key.length > 50 && key.includes('.')
      keyInput.style.borderColor = keyValid ? '#10b981' : '#ef4444'
    } else {
      keyInput.style.borderColor = '#d1d5db'
    }

    // Update test button state
    testButton.disabled = !urlValid || !keyValid
  }

  // Save settings
  async function saveSettings() {
    const url = urlInput.value.trim()
    const key = keyInput.value.trim()

    if (!url || !key) {
      showStatus('Please fill in all fields', 'error')
      return
    }

    // Validate URL format
    try {
      const urlObj = new URL(url)
      if (urlObj.protocol !== 'https:') {
        showStatus('URL must use HTTPS', 'error')
        return
      }
      if (!urlObj.hostname.includes('supabase')) {
        showStatus('URL should be a Supabase project URL', 'error')
        return
      }
    } catch {
      showStatus('Invalid URL format', 'error')
      return
    }

    // Validate key format (basic check)
    if (key.length < 50 || !key.includes('.')) {
      showStatus('Invalid key format. Please check your Supabase anon key.', 'error')
      return
    }

    // Save to storage
    try {
      await chrome.storage.sync.set({
        supabaseUrl: url,
        supabaseAnonKey: key
      })
      showStatus('Settings saved successfully!', 'success')
      await updateConfigStatus()
    } catch (error) {
      showStatus('Failed to save settings: ' + error.message, 'error')
    }
  }

  // Test connection
  async function testConnection() {
    const url = urlInput.value.trim()
    const key = keyInput.value.trim()

    if (!url || !key) {
      showStatus('Please configure settings first', 'error')
      return
    }

    // Save temporarily for test
    try {
      await chrome.storage.sync.set({
        supabaseUrl: url,
        supabaseAnonKey: key
      })
    } catch (error) {
      showStatus('Failed to save settings: ' + error.message, 'error')
      return
    }

    // Disable button during test
    testButton.disabled = true
    testButton.textContent = 'Testing...'

    try {
      const response = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' })
      
      if (response.success) {
        showStatus('✓ Connection successful! Extension is ready to use.', 'success')
        await updateConfigStatus()
      } else {
        showStatus('Connection failed: ' + (response.error || 'Unknown error'), 'error')
      }
    } catch (error) {
      showStatus('Connection test failed: ' + error.message, 'error')
    } finally {
      testButton.disabled = false
      testButton.textContent = 'Test Connection'
    }
  }

  // Show status message
  function showStatus(message, type) {
    status.textContent = message
    status.className = `status ${type}`
    status.style.display = 'block'
    
    setTimeout(() => {
      status.style.display = 'none'
    }, type === 'success' ? 5000 : 4000)
  }
})
