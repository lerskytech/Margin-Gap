# Extension Auth Implementation Notes

## Summary

Chrome extension now supports Supabase OAuth authentication, allowing users to create alerts directly from the extension that are tied to the same user/email as web app login.

## Implementation Details

### 1. Auth Flow (OAuth PKCE)

**Location**: `extension/background.js`

- Uses `chrome.identity.launchWebAuthFlow` for OAuth
- Implements PKCE (code verifier/challenge) for security
- Stores session in `chrome.storage.local` with:
  - `access_token`
  - `refresh_token`
  - `expires_at`
  - `user` object (id, email, etc.)

**Key Functions**:
- `signIn()` - Initiates OAuth flow, exchanges code for session
- `signOut()` - Clears session and calls Supabase logout
- `getSession()` - Returns current session, auto-refreshes if expired
- `getSessionStatus()` - Returns auth state for UI
- `refreshSession()` - Refreshes expired tokens

### 2. Authenticated API Calls

**Location**: `extension/background.js`

- `performScanRequest()` now includes `Authorization: Bearer <token>` header when session exists
- `createAlert()` requires authentication, returns structured error if missing
- All Edge Function calls include auth header when available

### 3. Popup UI (Set Alert)

**Location**: `extension/content.js`

**States**:
- **Not authenticated**: Shows "Sign in to enable alerts" button → opens options page
- **Authenticated**: Shows "Set Alert" button → expands inline form

**Inline Form**:
- Threshold type: `price_below`, `price_above`, `pct_below_msrp`, `pct_above_msrp`
- Threshold value: numeric input
- Save button calls `CREATE_ALERT` message to background
- Success: Shows "✓ Alert enabled" and auto-collapses after 1s
- Error: Shows error message inline

### 4. Options Page

**Location**: `extension/options.html` + `extension/options.js`

- Shows current auth status: "Signed in as {email}" or "Not signed in"
- "Sign in with Google" button → triggers OAuth flow
- "Sign Out" button (only visible when signed in)
- Auth section is separate from Supabase config section

## Testing Guide

### Local Testing

1. **Load Extension**:
   ```bash
   # In Chrome: chrome://extensions/
   # Enable "Developer mode"
   # Click "Load unpacked"
   # Select extension/ directory
   ```

2. **Configure Supabase**:
   - Open extension options (right-click extension icon → Options)
   - Enter Supabase URL and Anon Key
   - Click "Test Connection" to verify

3. **Test Sign In**:
   - In options page, click "Sign in with Google"
   - Complete OAuth flow in popup
   - Should see "✓ Signed in as {email}"
   - Check `chrome.storage.local` in DevTools → should see `supabase.auth.token`

4. **Test Alert Creation**:
   - Navigate to Facebook Marketplace / Amazon / Craigslist
   - Right-click a product name → "Check MarginGap"
   - Wait for scan results
   - Click "Set Alert" (should expand form if signed in)
   - Fill in threshold type and value
   - Click "Save Alert"
   - Should see "✓ Alert enabled" message

5. **Test Signed Out State**:
   - Sign out in options page
   - Right-click product → scan
   - "Set Alert" should show "Sign in to enable alerts"
   - Clicking it should open options page

### Verify Alert in Database

1. **Check Supabase Dashboard**:
   - Go to `product_alerts` table
   - Filter by your `user_email`
   - Verify alert row exists with:
     - `user_id` matches your auth user ID
     - `user_email` matches your email
     - `query_text` matches the scanned product
     - `condition` JSONB contains `{type, value}`
     - `is_active` = true

2. **Verify in Web App**:
   - Sign in to web app with same Google account
   - Alerts created in extension should appear in web app (if alerts page exists)

### Common Issues

1. **OAuth Flow Fails**:
   - Check Supabase redirect URLs include `chrome-extension://...`
   - Verify Google OAuth client has correct redirect URIs
   - Check browser console for errors

2. **"Authentication required" Error**:
   - Verify session exists in `chrome.storage.local`
   - Check token hasn't expired (refresh should happen automatically)
   - Try signing out and back in

3. **Alert Not Saving**:
   - Check browser console for error messages
   - Verify Supabase Edge Function `create-alert` is deployed
   - Check Edge Function logs in Supabase Dashboard

## Files Changed

### New Files
- `DEV_NOTES_EXTENSION.md` - This file

### Modified Files
- `extension/manifest.json` - Added `identity` permission
- `extension/background.js` - Added auth functions, updated API calls
- `extension/content.js` - Added inline alert form, auth state handling
- `extension/options.html` - Added auth section
- `extension/options.js` - Added auth status and sign in/out handlers

## Security Notes

- OAuth uses PKCE for security (code verifier/challenge)
- Session tokens stored in `chrome.storage.local` (not sync)
- Tokens auto-refresh when expired (5 min buffer)
- State parameter prevents CSRF attacks
- All Edge Function calls validate JWT on backend

## Important Configuration

### Supabase Redirect URLs

The extension uses `chrome.identity.getRedirectURL()` which returns:
```
https://<extension-id>.chromiumapp.org/
```

**You must add this URL to Supabase**:
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add to "Redirect URLs": `https://<your-extension-id>.chromiumapp.org/`
3. To find your extension ID:
   - Load extension in Chrome
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Find your extension → copy the ID
   - Format: `https://<id>.chromiumapp.org/`

### Google OAuth Setup

Ensure Google OAuth client has the same redirect URL:
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Edit your OAuth 2.0 Client
3. Add to "Authorized redirect URIs": `https://<extension-id>.chromiumapp.org/`

## Next Steps (Optional)

- Add alert list view in options page
- Add alert deletion from extension
- Sync alerts between extension and web app in real-time
- Add notification when alert triggers

