# Supabase Backend Setup Guide

Complete step-by-step guide to bootstrap your Supabase project for MarginGap.

## Prerequisites

- Node.js 18+ installed
- Supabase account (sign up at https://supabase.com)
- Supabase CLI installed (see below)

## Part 1: Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Linux
curl -fsSL https://github.com/supabase/cli/releases/download/v1.123.0/supabase_1.123.0_linux_amd64.deb -o supabase.deb
sudo dpkg -i supabase.deb

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Verify installation
supabase --version
```

## Part 2: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - **Name**: `margingap` (or your preferred name)
   - **Database Password**: Generate a strong password (save it securely)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is fine for development
4. Wait 2-3 minutes for project to provision

## Part 3: Link Local Project to Supabase

1. **Login to Supabase CLI:**
   ```bash
   supabase login
   ```
   This opens your browser to authenticate.

2. **Get your project reference:**
   - Go to Supabase Dashboard → Project Settings → General
   - Copy the "Reference ID" (looks like `abcdefghijklmnop`)

3. **Link your project:**
   ```bash
   cd /path/to/price-intel-scanner
   supabase link --project-ref mjjxvmumjfvlpfnkwzko
   ```
   When prompted, enter your database password.

4. **Verify link:**
   ```bash
   supabase status
   ```
   Should show your project details.

## Part 4: Apply Database Migrations

1. **Push migrations to Supabase:**
   ```bash
   supabase db push
   ```
   This applies all migrations in `supabase/migrations/` in order.

2. **Verify tables exist:**
   ```bash
   supabase db diff
   ```
   Should show no differences if migrations applied correctly.

3. **Or check in Dashboard:**
   - Go to Supabase Dashboard → Table Editor
   - You should see:
     - `profiles`
     - `products`
     - `scans`
     - `price_points`
     - `scan_credits`
     - `watchlist`
     - `watchlist_folders`
     - `watchlist_items`
     - `alert_rules`
     - `alert_events`
     - `saved_searches`

## Part 5: Configure Google OAuth

### 5.1 Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable "Google+ API" (or "Google Identity Services API")
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure:
   - **Application type**: Web application
   - **Name**: MarginGap (or your app name)
   - **Authorized JavaScript origins**:
     - `http://localhost:5173` (Vite dev server)
     - `http://localhost:3000` (if using different port)
     - `https://mjjxvmumjfvlpfnkwzko.supabase.co` (Supabase callback)
   - **Authorized redirect URIs**:
     - `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback`
     - `http://localhost:5173/auth/callback` (if needed)
6. Copy the **Client ID** and **Client Secret**

### 5.2 Configure Supabase Auth

1. Go to Supabase Dashboard → Authentication → Providers
2. Find "Google" and click to enable
3. Paste:
   - **Client ID (for OAuth)**: Your Google Client ID
   - **Client Secret (for OAuth)**: Your Google Client Secret
4. Click "Save"

### 5.3 Configure Redirect URLs

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Set **Site URL**:
   - Development: `http://localhost:5173`
   - Production: `https://your-production-domain.com`
3. Add **Redirect URLs** (one per line):
   ```
   http://localhost:5173
   http://localhost:5173/*
   https://your-production-domain.com
   https://your-production-domain.com/*
   https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback
   ```

## Part 6: Deploy Edge Functions

See `supabase/functions/README_DEPLOY.md` for detailed instructions.

Quick deploy:
```bash
# Deploy all functions
supabase functions deploy scan-product
supabase functions deploy ebay-search
supabase functions deploy ebay-sold
supabase functions deploy evaluate-alerts
supabase functions deploy send-email
```

### Required Edge Function Secrets

Go to Supabase Dashboard → Edge Functions → Secrets and add:

- `EBAY_CLIENT_ID` - Your eBay Application ID
- `EBAY_CLIENT_SECRET` - Your eBay Client Secret
- `EBAY_REDIRECT_URI` - Your eBay OAuth redirect URI (if using OAuth)
- `EBAY_ENV` - `sandbox` or `production`

**Note**: These secrets are only accessible in Edge Functions, never in the frontend.

## Part 7: Get Frontend Environment Variables

1. Go to Supabase Dashboard → Project Settings → API
2. Copy:
   - **Project URL**: `https://mjjxvmumjfvlpfnkwzko.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

3. Create `.env` file (see `ENV_SETUP.md`):
   ```env
   VITE_SUPABASE_URL=https://mjjxvmumjfvlpfnkwzko.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## Part 8: Verify Setup

### 8.1 Test Database

```bash
# Connect to database
supabase db remote commit

# Or use psql
supabase db remote psql
```

Run a test query:
```sql
SELECT * FROM public.profiles LIMIT 1;
```

### 8.2 Test Auth

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:5173/login`
3. Click "Continue with Google"
4. Complete OAuth flow
5. Should redirect back and show you as signed in

### 8.3 Test Edge Functions

1. **Test scan-product:**
   ```bash
   curl -X POST https://mjjxvmumjfvlpfnkwzko.supabase.co/functions/v1/scan-product \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"query": "iPhone 13", "region_key": "US"}'
   ```

2. **Check function logs:**
   ```bash
   supabase functions logs scan-product
   ```

## Part 9: Smoke Test Checklist

Run through this checklist to verify everything works:

- [ ] **App loads without errors**
  - Start: `npm run dev`
  - Navigate to `http://localhost:5173`
  - No console errors about Supabase

- [ ] **Login page shows Google button enabled**
  - Go to `/login`
  - "Continue with Google" button is NOT disabled
  - No "Auth is disabled" message

- [ ] **Google OAuth works**
  - Click "Continue with Google"
  - Completes OAuth flow
  - Returns to app signed in
  - User email appears in top bar

- [ ] **Dashboard loads**
  - Navigate to `/` (dashboard)
  - No null errors
  - Can see user profile data

- [ ] **Scan works (web app)**
  - Enter a product query (e.g., "iPhone 13")
  - Click "Scan"
  - Edge Function returns data
  - Chart displays results

- [ ] **Extension works (if testing)**
  - Load extension in Chrome
  - Configure Supabase credentials in Options
  - Right-click highlighted text → "Check MarginGap"
  - Popup shows price data

- [ ] **Database queries work**
  - Profile created automatically on sign-up
  - Scans saved to database
  - Watchlist items persist

## Troubleshooting

### Migration Errors

**Error: "extension 'uuid-ossp' does not exist"**
- Solution: Migration already includes `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
- If still fails, run manually:
  ```sql
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  ```

**Error: "function gen_random_uuid() does not exist"**
- Solution: Add to migration:
  ```sql
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  ```
- Or use `uuid_generate_v4()` from uuid-ossp instead

### Auth Errors

**"Redirect URI mismatch"**
- Check Google OAuth redirect URIs include:
  - `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback`
- Check Supabase redirect URLs include your app URL

**"Auth is disabled" message still shows**
- Verify `.env` file exists with correct values
- Restart dev server after creating `.env`
- Check `src/services/supabase.ts` reads env vars correctly

### Edge Function Errors

**"Function not found"**
- Deploy function: `supabase functions deploy FUNCTION_NAME`
- Check function name matches exactly

**"Missing environment variable"**
- Go to Dashboard → Edge Functions → Secrets
- Add required secrets (EBAY_CLIENT_ID, etc.)

**CORS errors**
- Verify `_shared/cors.ts` is imported
- Check CORS headers are set in response

## Next Steps

- Set up production environment variables
- Configure custom domain (optional)
- Set up email templates for alerts
- Configure rate limiting
- Set up monitoring/alerts

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)

