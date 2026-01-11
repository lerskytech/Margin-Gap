# Price Intel Scanner

A multi-marketplace price intelligence scanner built with React, TypeScript, Vite, and Supabase. This MVP provides a foundation for scanning prices across multiple marketplaces (eBay, Facebook Marketplace, OfferUp, Mercari) and analyzing pricing trends.

## Features

- 🔍 **Product Scanning**: Search and scan prices across multiple marketplaces
- 📊 **Price Intelligence**: View aggregated pricing data with fair value analysis
- 📈 **Trend Charts**: Visualize price trends over time with interactive charts
- 👁️ **Watchlist**: Save products to watchlist folders and track price changes
- 🔔 **Price Alerts**: Set custom alert rules (price thresholds, % changes)
- 📧 **Email Notifications**: Receive email alerts when price conditions are met
- 💳 **Credit System**: Monthly scan credits with tier-based limits
- 🔐 **Authentication**: Email/password + Google OAuth sign-in
- 👤 **User Profiles**: Manage profile settings, email preferences
- 🎨 **Modern UI**: Clean, responsive interface built with Tailwind CSS

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Routing**: React Router
- **Charts**: Recharts
- **Backend**: Supabase (Auth + PostgreSQL + Row Level Security)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account (or local Supabase instance)

### Installation

1. Clone the repository (or navigate to the project directory):
```bash
cd price-intel-scanner
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Configuration Matrix

The app uses two types of environment variables:

#### Frontend Environment Variables (`.env` file)
These are exposed to the browser and must be prefixed with `VITE_`:

| Variable | Required | Description | Where to Set |
|----------|----------|-------------|--------------|
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL | `.env` file |
| `VITE_SUPABASE_ANON_KEY` | Yes | Your Supabase anonymous key | `.env` file |
| `VITE_GOOGLE_PLACES_API_KEY` | No | Google Places API key (if used client-side) | `.env` file |

#### Edge Function Environment Variables (Supabase Dashboard)
These are server-side only and should **NOT** be in your `.env` file. Set them in **Supabase Dashboard > Edge Functions > Settings**:

| Variable | Required | Provider | Description |
|----------|----------|----------|-------------|
| `EBAY_APP_ID` | Yes (for eBay) | eBay | eBay Application ID (required for `get-trends` Edge Function) |
| `EBAY_OAUTH_CLIENT_ID` | Yes (for eBay) | eBay | eBay OAuth Client ID |
| `EBAY_OAUTH_CLIENT_SECRET` | Yes (for eBay) | eBay | eBay OAuth Client Secret |
| `EBAY_MARKETPLACE_ID` | No | eBay | Marketplace ID (default: `EBAY_US`) |
| `EBAY_GLOBAL_ID` | No | eBay | Global ID (default: `EBAY-US`) |
| `EBAY_ENV` | No | eBay | Environment: `production` or `sandbox` (default: `production`) |
| `FB_SCRAPER_PROXY_URL` | Future | Facebook | Proxy URL for Facebook Marketplace scraping |
| `MERCARI_PROXY_URL` | Future | Mercari | Proxy URL for Mercari API |
| `OFFERUP_PROXY_URL` | Future | OfferUp | Proxy URL for OfferUp API |
| `AMAZON_API_KEY` | Future | Amazon | Amazon Product Advertising API key |

**Provider Configuration Status:**

| Provider | Type | Status | Config Location |
|----------|------|--------|-----------------|
| eBay | API (Official) | ✅ Implemented | Supabase Edge Functions |
| Facebook Marketplace | Scrape/Proxy | 🔜 Planned | Supabase Edge Functions |
| OfferUp | Scrape/Proxy | 🔜 Planned | Supabase Edge Functions |
| Mercari | Scrape/Proxy | 🔜 Planned | Supabase Edge Functions |
| Amazon | API | 🔜 Planned | Supabase Edge Functions |

### Supabase Setup

#### Option 1: Hosted Supabase (Recommended for MVP)

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration files in order:
   - `supabase/migrations/20240101000000_initial_schema.sql`
   - `supabase/migrations/20240101000001_rls_policies.sql`
   - `supabase/migrations/20240101000002_handle_new_user.sql`
   - `supabase/migrations/20240102000000_accounts_alerts.sql` (NEW)
3. Copy your project URL and anon key to `.env`
4. **Enable Google OAuth Provider:**
   - Go to Authentication > Providers in Supabase Dashboard
   - Enable Google provider
   - Add your Google OAuth credentials (Client ID and Secret)
   - Add redirect URL: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
   - Also add your app's URL (e.g., `http://localhost:5173` for local dev)

#### Option 2: Local Supabase

1. Install Supabase CLI: `npm install -g supabase`
2. Initialize Supabase: `supabase init`
3. Start local Supabase: `supabase start`
4. Run migrations: `supabase db reset`
5. Use the local URL and anon key in `.env`

### Running the App

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## How It Works

### Scans and Credits

- Each scan consumes 1 credit
- Credits reset monthly based on your plan tier
- Free tier: 10 scans/month
- Credits are automatically deducted when you perform a scan
- The credit reset logic runs on the client side (can be moved to a server function later)

### Data Model

The app uses the following main tables:

- **profiles**: User profile information
- **products**: Canonical product records
- **scans**: Scan events (tracks when users scan products)
- **price_points**: Time-series price data (aggregated by source, region, date)
- **watchlist**: User's saved products
- **saved_searches**: User's saved search queries
- **scan_credits**: User's remaining credits and plan tier

### Provider Integration

The app includes provider adapters for:
- Amazon New (stub)
- **eBay (real implementation via Supabase Edge Functions)**
- Facebook Marketplace (mock data)
- OfferUp (mock data)
- Mercari (mock data)

#### eBay Integration (Real)

The eBay provider uses eBay's official Browse API (for active listings) and Finding API (for sold/completed items) via Supabase Edge Functions.

**Setup:**

1. **Create eBay Developer Account:**
   - Go to https://developer.ebay.com/
   - Create an app to get OAuth credentials

2. **Configure Supabase Edge Functions:**
   - Deploy the Edge Functions: 
     ```bash
     supabase functions deploy ebay-search
     supabase functions deploy ebay-sold
     supabase functions deploy get-trends
     ```
   - In Supabase Dashboard > Edge Functions > Settings, set these environment variables:
     - `EBAY_APP_ID` - Your eBay App ID (required for `get-trends` function)
     - `EBAY_OAUTH_CLIENT_ID` - Your eBay OAuth Client ID
     - `EBAY_OAUTH_CLIENT_SECRET` - Your eBay OAuth Client Secret
     - `EBAY_ENV` - `production` or `sandbox` (default: `production`)
     - `EBAY_MARKETPLACE_ID` - Marketplace ID (default: `EBAY_US`)
     - `EBAY_GLOBAL_ID` - Global ID (default: `EBAY-US`)
   
   **Note for Real-Time Trends:**
   - The `get-trends` Edge Function fetches real-time price trends from eBay sold listings
   - Requires `EBAY_APP_ID` to be set (uses eBay Finding API)
   - Trends are bucketed by day/week/month based on selected timeframe
   - If trends are unavailable, the UI shows "Trends unavailable for this source yet"

3. **Local Development:**
   ```bash
   # Start Supabase locally
   supabase start
   
   # Deploy functions locally
   supabase functions deploy ebay-search --no-verify-jwt
   supabase functions deploy ebay-sold --no-verify-jwt
   
   # Set function secrets locally
   supabase secrets set EBAY_APP_ID=your_app_id
   supabase secrets set EBAY_OAUTH_CLIENT_ID=your_client_id
   supabase secrets set EBAY_OAUTH_CLIENT_SECRET=your_client_secret
   ```

**Known Limitations:**
- eBay Finding API (sold items) returns XML - the implementation uses DOMParser (if available) with a regex-based fallback parser for basic XML structure parsing.
- Time-series history comes from stored scans in the database, not directly from eBay (eBay APIs don't provide historical price data beyond the current search results).
- Rate limits apply based on your eBay API tier (typically 5,000 calls/day for production).
- The sold items endpoint uses eBay's Finding API which has slower response times than Browse API - consider implementing request caching.

**Smoke Testing eBay Functions:**
```bash
# Test active listings (replace with your Supabase URL and anon key)
curl -X GET "https://YOUR_PROJECT.supabase.co/functions/v1/ebay-search?q=iPhone+13&limit=10" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Test sold listings
curl -X GET "https://YOUR_PROJECT.supabase.co/functions/v1/ebay-sold?q=iPhone+13&limit=10" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**To integrate other providers:**

1. Replace the mock implementations in `/src/providers/`
2. Implement the actual API calls in each provider function (consider using Edge Functions for API keys)
3. Map the provider's response format to our `ProviderResponse` interface
4. Update the scan service to handle authentication/API keys as needed

#### Email Delivery Setup (Alerts)

1. **Choose an email provider** (Resend recommended):
   - Sign up at [resend.com](https://resend.com)
   - Get your API key

2. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy send-email
   supabase functions deploy evaluate-alerts
   ```

3. **Set Edge Function environment variables** in Supabase Dashboard > Edge Functions > Settings:
   - `RESEND_API_KEY` - Your Resend API key
   - `EMAIL_FROM` - Your verified sender email (e.g., `alerts@yourdomain.com`)
   - `SUPABASE_URL` - Your Supabase project URL (auto-set)
   - `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (for evaluate-alerts)
   - `SUPABASE_ANON_KEY` - Your anon key (for evaluate-alerts)
   - `APP_URL` - Your app URL (e.g., `https://yourdomain.com`)

4. **Test email delivery:**
   - Sign up and create a watchlist item
   - Click "Set Alert" and then "Send Test Email"
   - Check your inbox

**Note:** If email is not configured, the app will show a friendly message and continue to work. Email delivery is optional for MVP.

#### Alert Evaluation

The `evaluate-alerts` Edge Function can be called manually (via "Evaluate Alerts Now" button in debug drawer) or scheduled via cron later. For now, it's foundation-only - no automatic scheduling is set up.

**To test alert evaluation:**
1. Add a product to watchlist
2. Create an alert rule (e.g., "Price below $100")
3. Update the watchlist item's `last_price` in the database to trigger the rule
4. Click "Evaluate Alerts Now" in the debug drawer
5. Check your email for the alert notification

### Mock Data

The app currently uses realistic mock data for development. This includes:
- Deterministic price data based on product queries
- Time-series data for charts
- Multiple marketplace sources

Replace mock providers with real API integrations when ready.

## Project Structure

```
src/
├── components/          # Layout components
│   └── layout/         # TopBar, Sidebar, AppLayout
├── features/           # Business logic modules
│   ├── analysis/       # Verdict engine
│   ├── charts/         # Chart data builders
│   ├── scans/          # Scan service/orchestrator
│   └── watchlist/      # Watchlist hooks
├── lib/                # Utilities and types
├── pages/              # Page components
├── providers/          # Marketplace provider adapters
├── services/           # API clients (Supabase, Google Places)
├── store/              # Zustand stores
└── ui/                 # Reusable UI components
```

## Development

### Type Checking

```bash
npm run build
```

### Linting

```bash
npm run lint
```

### Building for Production

```bash
npm run build
npm run preview
```

## Future Integration Points

1. **Real Provider APIs**: Replace mock providers with actual marketplace APIs
2. **Google Places**: Integrate Google Places API for location search
3. **Payment Integration**: Add Stripe/Paddle for plan upgrades
4. **Email Notifications**: Set up email alerts for price changes
5. **Server Functions**: Move credit reset logic to Supabase Edge Functions
6. **Background Jobs**: Set up scheduled scans for watchlist items

## License

MIT

## Contributing

This is an MVP scaffold. Contributions and improvements are welcome!

---

**Note**: This is a development scaffold. For production use, ensure:
- Proper error handling and monitoring
- Rate limiting on API calls
- Security review of RLS policies
- Performance optimization
- Comprehensive testing
