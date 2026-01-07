# Extension Deployment Guide

## Prerequisites

1. Supabase project with Edge Functions enabled
2. Chrome browser for testing
3. Extension icons (16x16, 48x48, 128x128 PNG)

## Step 1: Deploy Edge Function

```bash
cd supabase/functions/scan-product
supabase functions deploy scan-product
```

Verify deployment:
```bash
supabase functions list
```

## Step 2: Configure Extension

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` folder
5. Click extension icon → "Options"
6. Enter Supabase URL and Anon Key
7. Click "Save Settings"

## Step 3: Test

1. Navigate to Facebook Marketplace
2. Highlight a product name
3. Right-click → "Check MarginGap"
4. Verify popup appears with data

## Step 4: Package for Distribution

```bash
cd extension
zip -r margingap-extension.zip . -x "*.git*" "*.md" "node_modules/*"
```

## Step 5: Chrome Web Store (Future)

1. Create developer account ($5 one-time fee)
2. Upload ZIP file
3. Fill store listing:
   - Name: "MarginGap Price Intel"
   - Description: "Ultra-fast price intelligence for resellers"
   - Screenshots: 1280x800 or 640x400
   - Promotional images
4. Submit for review

## Environment Variables

The Edge Function automatically has access to:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

No manual configuration needed for Edge Functions.

## Rate Limiting

Add rate limiting to `scan-product/index.ts`:

```typescript
// Simple in-memory rate limit (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const rateLimitKey = user_id || `anon:${req.headers.get('x-forwarded-for')}`
const now = Date.now()
const limit = rateLimitMap.get(rateLimitKey)

if (limit && limit.resetAt > now && limit.count >= 10) {
  return new Response(
    JSON.stringify({ error: 'Rate limit exceeded' }),
    { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Update rate limit
rateLimitMap.set(rateLimitKey, {
  count: (limit?.count || 0) + 1,
  resetAt: now + 3600000 // 1 hour
})
```

## Monitoring

Monitor Edge Function logs:
```bash
supabase functions logs scan-product
```

## Troubleshooting

### Extension not loading
- Check `manifest.json` syntax
- Verify all files exist
- Check Chrome console for errors

### Popup not appearing
- Verify content script is injected (check page console)
- Check background script logs
- Verify Supabase credentials are set

### API errors
- Check Edge Function logs
- Verify Supabase URL/key are correct
- Check CORS headers

### Slow responses
- Edge Function cold start (first request)
- Consider adding caching
- Optimize provider calls

