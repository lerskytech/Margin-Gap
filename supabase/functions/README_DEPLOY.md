# Edge Functions Deployment Guide

Deploy MarginGap Edge Functions to Supabase.

## Prerequisites

- Supabase project linked (see `SUPABASE_SETUP.md`)
- Supabase CLI installed and authenticated
- Required secrets configured (see below)

## Quick Deploy

Deploy all functions:

```bash
# From project root
cd supabase/functions

# Deploy each function
supabase functions deploy scan-product
supabase functions deploy ebay-search
supabase functions deploy ebay-sold
supabase functions deploy evaluate-alerts
supabase functions deploy send-email
```

Or deploy all at once:

```bash
# Deploy all functions in the functions directory
for func in scan-product ebay-search ebay-sold evaluate-alerts send-email; do
  supabase functions deploy $func
done
```

## Function Details

### scan-product

**Purpose**: Main product scanning endpoint for web app and extension.

**Deploy:**
```bash
supabase functions deploy scan-product
```

**Dependencies**: None (calls other functions internally)

**Environment Variables**: None required

**Test:**
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/scan-product \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "iPhone 13", "region_key": "US"}'
```

### ebay-search

**Purpose**: Search eBay active listings.

**Deploy:**
```bash
supabase functions deploy ebay-search
```

**Dependencies**: Requires eBay API credentials

**Required Secrets** (set in Dashboard → Edge Functions → Secrets):
- `EBAY_OAUTH_CLIENT_ID` - eBay OAuth Client ID
- `EBAY_OAUTH_CLIENT_SECRET` - eBay OAuth Client Secret
- `EBAY_APP_ID` - eBay Application ID (for Finding API fallback)
- `EBAY_ENV` - `sandbox` or `production` (default: `production`)
- `EBAY_MARKETPLACE_ID` - eBay Marketplace ID (default: `EBAY_US`)
- `EBAY_GLOBAL_ID` - eBay Global ID (default: `EBAY-US`)

**Test:**
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/ebay-search \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q": "iPhone 13", "limit": 10}'
```

### ebay-sold

**Purpose**: Fetch eBay sold/completed listings for price history.

**Deploy:**
```bash
supabase functions deploy ebay-sold
```

**Dependencies**: Same as `ebay-search`

**Required Secrets**: Same as `ebay-search`
- `EBAY_OAUTH_CLIENT_ID`
- `EBAY_OAUTH_CLIENT_SECRET`
- `EBAY_APP_ID`
- `EBAY_ENV`

**Test:**
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/ebay-sold \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q": "iPhone 13", "limit": 10}'
```

### evaluate-alerts

**Purpose**: Evaluate alert rules and trigger notifications.

**Deploy:**
```bash
supabase functions deploy evaluate-alerts
```

**Dependencies**: Database (alert_rules, watchlist_items tables)

**Environment Variables**: None required

**Note**: Typically called via cron/scheduler, not directly.

### send-email

**Purpose**: Send email notifications for alerts.

**Deploy:**
```bash
supabase functions deploy send-email
```

**Dependencies**: Email service (Resend, SendGrid, etc.)

**Required Secrets** (if using email service):
- `RESEND_API_KEY` - Resend API key (or equivalent)
- `EMAIL_FROM` - Sender email address

**Note**: Configure email service in function code.

## Setting Secrets

Secrets are set via Supabase Dashboard or CLI:

### Via Dashboard

1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Click "Add Secret"
3. Enter:
   - **Name**: `EBAY_CLIENT_ID` (or other secret name)
   - **Value**: Your secret value
4. Click "Save"

### Via CLI

```bash
# Set secrets (one at a time)
supabase secrets set EBAY_OAUTH_CLIENT_ID=your_oauth_client_id
supabase secrets set EBAY_OAUTH_CLIENT_SECRET=your_oauth_client_secret
supabase secrets set EBAY_APP_ID=your_app_id
supabase secrets set EBAY_ENV=production

# List all secrets (values hidden)
supabase secrets list

# Unset a secret
supabase secrets unset EBAY_OAUTH_CLIENT_ID
```

## Verifying Deployment

1. **Check function exists:**
   ```bash
   supabase functions list
   ```

2. **View function logs:**
   ```bash
   supabase functions logs scan-product
   supabase functions logs ebay-search --tail
   ```

3. **Test function:**
   - Use curl commands above
   - Or test from web app/extension

## Troubleshooting

### "Function not found"

- Deploy the function: `supabase functions deploy FUNCTION_NAME`
- Check function name matches exactly (case-sensitive)
- Verify you're in the correct project: `supabase status`

### "Missing environment variable"

- Set secret in Dashboard or via CLI
- Restart function (redeploy)
- Check secret name matches exactly (case-sensitive)

### CORS Errors

- Verify `_shared/cors.ts` is imported
- Check CORS headers in function response
- Ensure `corsHeaders` are included in all responses

### Function Timeout

- Check function execution time (max 60s on free tier)
- Optimize function code
- Consider breaking into smaller functions

### Authentication Errors

- Verify `Authorization: Bearer` header includes anon key
- Check RLS policies allow function access
- Ensure function has proper error handling

## Local Development

Test functions locally:

```bash
# Start local Supabase (includes functions)
supabase start

# Invoke function locally
supabase functions serve scan-product

# Test locally
curl -X POST http://localhost:54321/functions/v1/scan-product \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "iPhone 13"}'
```

## Production Best Practices

1. **Set up monitoring:**
   - Use Supabase Dashboard → Edge Functions → Logs
   - Set up alerts for errors

2. **Rate limiting:**
   - Implement in function code
   - Use Supabase rate limiting features

3. **Error handling:**
   - All functions should return structured errors
   - Never expose internal errors to clients

4. **Security:**
   - Never log secrets
   - Validate all inputs
   - Use RLS policies for data access

## Function Structure

All functions follow this pattern:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Function logic
    const result = await doSomething()
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
```

## Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Deploy Docs](https://deno.com/deploy/docs)
- [Supabase CLI Functions](https://supabase.com/docs/reference/cli/supabase-functions)

