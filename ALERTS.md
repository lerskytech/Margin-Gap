# Alerts System Documentation

## Overview

The MarginGap alerts system allows users to set up price monitoring for products and receive email notifications when conditions are met.

## Architecture

### Database Schema

**Table: `product_alerts`**
- `id` (UUID, primary key)
- `user_id` (UUID, references auth.users)
- `query_text` (TEXT, normalized product keyword)
- `scope` (TEXT, 'national' or 'local')
- `region` (TEXT, optional city/state)
- `condition` (JSONB, e.g., `{"type":"gap_above","value":50}`)
- `is_active` (BOOLEAN)
- `last_triggered_at` (TIMESTAMPTZ)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**RLS Policies:**
- Users can only view/modify their own alerts
- All operations require authentication

### Edge Functions

1. **`create-alert`** - Creates a new alert
   - Requires: JWT token in Authorization header
   - Body: `{ query_text, scope?, region?, condition: { type, value } }`
   - Returns: Created alert object

2. **`list-alerts`** - Lists user's alerts
   - Requires: JWT token in Authorization header
   - Query param: `active_only=true` (optional)
   - Returns: Array of alerts

3. **`delete-alert`** - Deletes an alert by ID
   - Requires: JWT token in Authorization header
   - Body: `{ id }`
   - Returns: Success status

4. **`run-alerts`** - Scheduled function that evaluates all active alerts
   - Requires: Service role key (for cron/scheduled calls)
   - Evaluates each alert by calling `scan-product`
   - Sends email via `send-email` function when condition is met
   - Enforces 6-hour cooldown between alerts
   - Returns: `{ processed, triggered, errors }`

### Alert Condition Types

- `gap_above`: Gap (MSRP - Market Price) above $X
- `price_below`: Market price below $X
- `price_above`: Market price above $X
- `pct_below_msrp`: Market price % below MSRP
- `pct_above_msrp`: Market price % above MSRP

## Setup

### 1. Apply Database Migration

```bash
supabase db push
```

Or manually run:
```sql
-- See: supabase/migrations/20240103000000_product_alerts.sql
```

### 2. Deploy Edge Functions

```bash
supabase functions deploy create-alert
supabase functions deploy list-alerts
supabase functions deploy delete-alert
supabase functions deploy run-alerts
```

### 3. Configure Email Provider

Set these secrets in Supabase Dashboard → Edge Functions → Secrets:

- `RESEND_API_KEY` - Your Resend API key (get from https://resend.com)
- `EMAIL_FROM` - Verified sender email (e.g., `alerts@yourdomain.com`)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for run-alerts)

### 4. Schedule Alert Runner

Set up a cron job to call `run-alerts` periodically:

**Option A: Supabase Cron (Recommended)**
1. Go to Supabase Dashboard → Database → Cron Jobs
2. Create new cron job:
   - Name: `run-alerts`
   - Schedule: `0 */6 * * *` (every 6 hours)
   - SQL:
   ```sql
   SELECT net.http_post(
     url := 'https://YOUR_PROJECT.supabase.co/functions/v1/run-alerts',
     headers := jsonb_build_object(
       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
       'Content-Type', 'application/json'
     ),
     body := '{}'::jsonb
   );
   ```

**Option B: External Cron (Vercel Cron, GitHub Actions, etc.)**
- Call: `POST https://YOUR_PROJECT.supabase.co/functions/v1/run-alerts`
- Header: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

## Usage

### Web App

1. **Create Alert:**
   - Perform a scan
   - Click "Set Alert" in Actions panel
   - Fill in condition type and value
   - Click "Create Alert"

2. **View Alerts:**
   - (Future: Alerts management page)

3. **Delete Alert:**
   - (Future: Alerts management page)

### Extension

1. **Right-click product text** → "Check MarginGap"
2. If authenticated: Click "Set Alert" → Opens web app with pre-filled query
3. If not authenticated: Click "Sign in to enable alerts" → Opens login page

## Auth Bridge (Web App → Extension)

The web app syncs the Supabase session to the extension via `chrome.runtime.sendMessage`:

- **Message Type:** `SET_AUTH_SESSION`
- **Payload:** Session object with `access_token`, `user`, etc.
- **Storage:** `chrome.storage.local['supabase.auth.token']`

The extension checks auth state via:
- **Message Type:** `GET_AUTH_STATE`
- **Returns:** `{ isAuthenticated, userId, email }`

## Email Delivery

Alerts are sent via the `send-email` Edge Function using Resend:
- HTML email template with product details
- Includes market price, MSRP, gap, confidence score
- Link to view on MarginGap

## Testing

### Test Create Alert

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/create-alert \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query_text": "iPhone 13",
    "scope": "national",
    "condition": {
      "type": "gap_above",
      "value": 50
    }
  }'
```

### Test List Alerts

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/list-alerts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"active_only": true}'
```

### Test Run Alerts (Manual)

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/run-alerts \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Troubleshooting

### Alerts not triggering

1. **Check alert is active:**
   ```sql
   SELECT * FROM product_alerts WHERE is_active = true;
   ```

2. **Check last triggered:**
   ```sql
   SELECT id, query_text, last_triggered_at, created_at 
   FROM product_alerts 
   WHERE is_active = true;
   ```

3. **Check cooldown:** Alerts have a 6-hour cooldown. If `last_triggered_at` is recent, it won't trigger again.

4. **Check email configuration:**
   - Verify `RESEND_API_KEY` is set
   - Verify `EMAIL_FROM` is verified in Resend
   - Check Edge Function logs for email errors

### Extension auth not working

1. **Check session sync:**
   - Open browser console on web app
   - Check for `Extension auth sync` messages
   - Verify `chrome.runtime.sendMessage` succeeds

2. **Check extension storage:**
   - Open extension options page
   - Check `chrome.storage.local` for `supabase.auth.token`

3. **Verify manifest permissions:**
   - Ensure `tabs` permission is in `manifest.json`

### Email not sending

1. **Check Resend API key:**
   - Verify key is correct in Supabase secrets
   - Test key directly with Resend API

2. **Check email address:**
   - Verify user's email in `profiles` table
   - Ensure email is valid format

3. **Check rate limits:**
   - Resend has rate limits (check their dashboard)
   - Function has 10 emails/hour per user limit

## Future Enhancements

- [ ] Alerts management page (list, edit, delete)
- [ ] SMS notifications (via Twilio)
- [ ] Alert history/logs
- [ ] Multiple conditions per alert
- [ ] Alert templates
- [ ] Bulk alert operations

