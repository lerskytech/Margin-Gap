# Supabase Code Reference

Complete reference of all Supabase-related code in the MarginGap project.

## Frontend Supabase Client

### `src/services/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseEnabled = !!(supabaseUrl && supabaseAnonKey)

if (!supabaseEnabled) {
  console.warn('Missing Supabase environment variables. App will use mock data only.')
}

export const supabase = supabaseEnabled
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : (null as any) // Type-safe workaround for optional Supabase
```

**Key Points:**
- Exports `supabaseEnabled` boolean for feature flags
- Creates Supabase client only if env vars exist
- Returns `null` in mock mode (handled gracefully throughout app)

---

## Database Migrations

### Migration 1: `supabase/migrations/20240101000000_initial_schema.sql`
**Creates:**
- `profiles` table (extends auth.users)
- `products` table
- `scan_credits` table
- `scans` table
- `price_points` table (time-series data)
- `watchlist` table
- `saved_searches` table
- Triggers for `updated_at` timestamps
- Indexes for performance

**Extensions:**
- `uuid-ossp` for UUID generation

### Migration 2: `supabase/migrations/20240101000001_rls_policies.sql`
**Enables Row Level Security (RLS) on:**
- `profiles` - Users can only view/update their own
- `scan_credits` - Users can only view/update their own
- `scans` - Users can only view/insert their own
- `watchlist` - Users can only manage their own
- `saved_searches` - Users can only manage their own
- `products` - Authenticated users can read/insert
- `price_points` - Authenticated users can read/insert

### Migration 3: `supabase/migrations/20240101000002_handle_new_user.sql`
**Creates:**
- `handle_new_user()` function (triggered on user signup)
- Automatically creates profile
- Initializes scan credits (10 credits, free tier)
- Trigger: `on_auth_user_created`

### Migration 4: `supabase/migrations/20240102000000_accounts_alerts.sql`
**Adds:**
- Enhanced profile fields (display_name, phone, avatar_url, email_opt_in, sms_opt_in)
- `watchlist_folders` table
- `watchlist_items` table (replaces/enhances watchlist)
- `alert_rules` table
- `alert_events` table
- Updated `handle_new_user()` function
- RLS policies for all new tables
- `pgcrypto` extension for `gen_random_uuid()`

---

## Edge Functions

### Shared Utilities

#### `supabase/functions/_shared/cors.ts`
```typescript
// CORS headers for Supabase Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

### Main Functions

#### 1. `scan-product` - Product Scanning API
**File:** `supabase/functions/scan-product/index.ts`

**Purpose:** Main endpoint for web app and Chrome extension to scan products.

**Input:**
```typescript
{
  query: string
  region_key?: string  // Default: 'US'
  user_id?: string     // Optional, for saving scans
}
```

**Output:**
```typescript
{
  scan_id: string
  product_id: string
  query: string
  region_key: string
  aggregates: PriceAggregate[]
  verdict: {
    status: 'at_market' | 'undervalued' | 'overpriced'
    confidence_score: number  // 0-1
    fair_value_range: { low: number, high: number }
  }
  scanned_at: string
  listings: Listing[]
  meta?: {
    requestId: string
    generatedAt: string
    cacheHit: boolean
    providerStatuses: Array<{ provider: string, status: string }>
  }
  provenance?: {
    totalListings: number
    sources: Array<{ name: string, count: number }>
    updatedAt: string
  }
}
```

**Features:**
- Calls `ebay-search` internally
- Calculates verdict using IQR method
- Saves scan to database if `user_id` provided
- Returns optional `meta` and `provenance` fields
- Handles errors gracefully

#### 2. `ebay-search` - eBay Active Listings
**File:** `supabase/functions/ebay-search/index.ts`

**Purpose:** Search eBay Browse API for active listings.

**Required Secrets:**
- `EBAY_OAUTH_CLIENT_ID`
- `EBAY_OAUTH_CLIENT_SECRET`
- `EBAY_ENV` (sandbox/production)
- `EBAY_APP_ID` (optional, for Finding API fallback)
- `EBAY_MARKETPLACE_ID` (optional, default: EBAY_US)
- `EBAY_GLOBAL_ID` (optional, default: EBAY-US)

**Input:**
```typescript
{
  q: string
  limit?: number
  condition?: string
  categoryId?: string
  region_key?: string
}
```

**Output:**
```typescript
{
  aggregates: PriceAggregate[]
  listings: Listing[]
}
```

#### 3. `ebay-sold` - eBay Sold Listings
**File:** `supabase/functions/ebay-sold/index.ts`

**Purpose:** Fetch completed/sold listings for price history.

**Required Secrets:** Same as `ebay-search`

#### 4. `evaluate-alerts` - Alert Evaluation
**File:** `supabase/functions/evaluate-alerts/index.ts`

**Purpose:** Evaluate alert rules and trigger notifications.

**Note:** Typically called via cron/scheduler.

#### 5. `send-email` - Email Notifications
**File:** `supabase/functions/send-email/index.ts`

**Purpose:** Send email alerts.

**Required Secrets (if using email service):**
- `RESEND_API_KEY` (or equivalent)
- `EMAIL_FROM`

---

## Auth Service

### `src/services/auth.ts`

**Key Functions:**
- `signUp(email, password)` - Returns safe default if disabled
- `signIn(email, password)` - Throws error if disabled
- `signInWithGoogle(redirectTo?)` - Returns `{ url: null }` if disabled
- `signOut()` - No-op if disabled
- `getSession()` - Returns `null` if disabled
- `getUser()` - Returns `null` if disabled
- `getProfile(userId)` - Returns `null` if disabled
- `updateProfile(updates)` - Returns `null` if disabled
- `onAuthStateChange(callback)` - Returns no-op unsubscribe if disabled

**All functions check `supabaseEnabled` before calling Supabase APIs.**

---

## Auth Store

### `src/store/authStore.ts`

**State:**
```typescript
{
  user: AuthUser | null
  loading: boolean
  initialized: boolean
  isEnabled: boolean  // Based on supabaseEnabled
}
```

**Key Behavior:**
- `initialize()` skips auth calls if `supabaseEnabled` is false
- Sets `isEnabled: false` in mock mode
- Prevents duplicate initialization
- Only sets up auth state listener when enabled

---

## Database Schema Summary

### Core Tables

1. **profiles** - User profiles (extends auth.users)
2. **products** - Product catalog
3. **scans** - User scan history
4. **price_points** - Time-series price data
5. **scan_credits** - User credit balance
6. **watchlist** - Legacy watchlist (deprecated)
7. **watchlist_folders** - Watchlist organization
8. **watchlist_items** - Enhanced watchlist items
9. **alert_rules** - Price alert rules
10. **alert_events** - Alert trigger history
11. **saved_searches** - Saved search queries

### Key Functions

- `handle_new_user()` - Auto-creates profile and credits on signup
- `update_updated_at_column()` - Auto-updates `updated_at` timestamps

### Security

- Row Level Security (RLS) enabled on all tables
- Policies ensure users can only access their own data
- Products and price_points are readable by all authenticated users

---

## Environment Variables

### Frontend (`.env`)
```env
VITE_SUPABASE_URL=https://mjjxvmumjfvlpfnkwzko.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Edge Functions (Supabase Dashboard → Secrets)
```
EBAY_OAUTH_CLIENT_ID=...
EBAY_OAUTH_CLIENT_SECRET=...
EBAY_APP_ID=...
EBAY_ENV=production
EBAY_MARKETPLACE_ID=EBAY_US
EBAY_GLOBAL_ID=EBAY-US
RESEND_API_KEY=... (optional)
EMAIL_FROM=... (optional)
```

---

## Deployment Commands

```bash
# Link project
supabase link --project-ref mjjxvmumjfvlpfnkwzko

# Apply migrations
supabase db push

# Deploy functions
supabase functions deploy scan-product
supabase functions deploy ebay-search
supabase functions deploy ebay-sold
supabase functions deploy evaluate-alerts
supabase functions deploy send-email

# Set secrets
supabase secrets set EBAY_OAUTH_CLIENT_ID=your_id
supabase secrets set EBAY_OAUTH_CLIENT_SECRET=your_secret
```

---

## File Structure

```
supabase/
├── migrations/
│   ├── 20240101000000_initial_schema.sql
│   ├── 20240101000001_rls_policies.sql
│   ├── 20240101000002_handle_new_user.sql
│   └── 20240102000000_accounts_alerts.sql
├── functions/
│   ├── _shared/
│   │   ├── cors.ts
│   │   ├── outliers.ts
│   │   └── xml.ts
│   ├── scan-product/
│   │   └── index.ts
│   ├── ebay-search/
│   │   └── index.ts
│   ├── ebay-sold/
│   │   └── index.ts
│   ├── evaluate-alerts/
│   │   └── index.ts
│   ├── send-email/
│   │   └── index.ts
│   └── README_DEPLOY.md
└── seed.sql

src/
├── services/
│   ├── supabase.ts          # Supabase client
│   ├── auth.ts              # Auth service
│   └── database.types.ts    # TypeScript types
└── store/
    └── authStore.ts         # Auth state management
```

---

## Quick Reference

**Check if Supabase is enabled:**
```typescript
import { supabaseEnabled } from '@/services/supabase'
if (supabaseEnabled) { /* ... */ }
```

**Use Supabase client:**
```typescript
import { supabase } from '@/services/supabase'
if (supabase) {
  const { data } = await supabase.from('products').select('*')
}
```

**Call Edge Function:**
```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/scan-product`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: 'iPhone 13' })
})
```

---

For detailed setup instructions, see:
- `SUPABASE_SETUP.md` - Complete setup guide
- `ENV_SETUP.md` - Environment variables guide
- `supabase/functions/README_DEPLOY.md` - Edge function deployment

