# Extension Integration Guide

## Supabase Edge Function Setup

The extension requires a `scan-product` Edge Function. Deploy it:

```bash
cd supabase/functions/scan-product
supabase functions deploy scan-product
```

## Environment Variables

The Edge Function needs:
- `SUPABASE_URL` (auto-set by Supabase)
- `SUPABASE_ANON_KEY` (auto-set by Supabase)

## Extension Configuration

Users must configure Supabase credentials in the extension:

1. Via Chrome storage sync:
   ```javascript
   chrome.storage.sync.set({
     supabaseUrl: 'https://your-project.supabase.co',
     supabaseAnonKey: 'your-anon-key'
   })
   ```

2. Or via options page (TODO: create options.html)

## Authentication Flow

### Anonymous Users
- Extension works without login
- Limited scans/day (enforced server-side)
- Reduced confidence indicators
- No saved scans

### Authenticated Users
- Extension detects Supabase session from web app
- Full accuracy
- Saved scans
- Watchlist sync (future)
- Alert hooks (future)

### Session Detection

The extension checks for Supabase session:

```javascript
// In background.js
const session = await chrome.storage.local.get(['supabase.auth.token'])
const userId = session['supabase.auth.token']?.user?.id || null
```

**Note**: This requires the web app to share session with extension. Options:

1. **Shared storage** (current approach):
   - Web app stores session in `chrome.storage.local`
   - Extension reads from same storage
   - Requires extension ID to be known

2. **OAuth flow** (future):
   - Extension opens auth popup
   - User signs in via web app
   - Session token passed back to extension

## API Endpoints Used

### Primary: `scan-product`
- **URL**: `/functions/v1/scan-product`
- **Method**: POST
- **Auth**: Bearer token (anon key or user session)
- **Body**:
  ```json
  {
    "query": "iPhone 13",
    "region_key": "US",
    "user_id": "optional-user-id"
  }
  ```
- **Response**: `ScanResult` (see `src/lib/types.ts`)

### Future: Additional Endpoints
- `/functions/v1/watchlist` - Sync watchlist
- `/functions/v1/alerts` - Check/create alerts
- `/functions/v1/scan-history` - Get user's scan history

## Rate Limiting

The Edge Function should implement rate limiting:

- **Anonymous**: 10 scans/hour
- **Authenticated**: Based on credit tier (free/basic/pro/expert)

Add to `scan-product/index.ts`:
```typescript
// Check rate limit
const rateLimitKey = user_id || `anon:${req.headers.get('x-forwarded-for')}`
// ... rate limit logic
```

## Error Handling

The extension handles these errors gracefully:

1. **Network errors**: "Unable to check price. Please try again."
2. **No data**: "Not enough data. Product too ambiguous."
3. **Rate limit**: "Too many requests. Please wait a moment."
4. **Auth errors**: Falls back to anonymous mode

## Performance Targets

- **Response time**: <500ms perceived (loading state shown immediately)
- **Popup render**: <100ms after data received
- **Memory**: <10MB extension footprint
- **No page slowdown**: Content script runs at `document_idle`

## Testing Checklist

- [ ] Context menu appears on supported sites
- [ ] Popup shows loading state
- [ ] Popup displays price data correctly
- [ ] Error states work
- [ ] Close button works
- [ ] Outside click closes popup
- [ ] Scroll closes popup
- [ ] Works on Facebook Marketplace
- [ ] Works on Amazon
- [ ] Works on Craigslist
- [ ] Anonymous mode works
- [ ] Authenticated mode works (if session available)

## Deployment

1. **Build extension** (no build needed - vanilla JS)
2. **Create icons** (16x16, 48x48, 128x128 PNG)
3. **Deploy Edge Function**: `supabase functions deploy scan-product`
4. **Test locally**: Load unpacked extension
5. **Publish**: Chrome Web Store (when ready)

## Future Enhancements

See `README.md` TODOs section for roadmap.

