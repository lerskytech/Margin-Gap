# Development Notes - MarginGap Improvements

## Summary of Changes

This document summarizes the improvements made to fix Recent Scans duplicates, Actions panel functionality, and alerts system.

## 1. Recent Scans Deduplication ✅

### Problem
Recent Scans showed duplicates when the same query was scanned multiple times, and selecting items could add more duplicates.

### Solution
- Created `src/utils/scanKey.ts` with `makeScanKey()` function that generates stable keys from:
  - Normalized query (lowercase, trimmed)
  - Region/scope
  - Sorted list of source types
- Updated `src/store/scanStore.ts`:
  - Changed `RecentScan` interface to include `scanKey`, `latestScanId`, `count`, and `allScanIds[]`
  - Modified `performScan()` to group scans by `scanKey` instead of `scan_id`
  - When a scan with existing key is added, increment count and update latest scan
  - `selectScan()` now only selects from cache without adding to recent scans
- Updated `src/components/layout/Sidebar.tsx`:
  - Display shows count badge (×N) when count > 1
  - Shows relative time (e.g., "2h ago", "3d ago")
  - Shows scope (region_key)
  - Empty state: "Run a scan to see history here"

### Testing
- Run 10 scans with same query → should show ONE item with badge ×10
- Clicking it should NOT add more entries
- Different queries/regions show as separate items

## 2. Actions Panel Fixes ✅

### Problem
Actions panel showed "Sign in to activate" even when authenticated, and buttons were disabled incorrectly.

### Solution
- Updated `src/ui/ProductIntelligencePanel.tsx`:
  - Added explicit `isAuthed` derived flag
  - Fixed button labels:
    - Baseline: "Run a scan to activate"
    - Not authenticated: "Sign in to activate"
    - Authenticated + has scan: no label (enabled)
  - Set Alert: disabled only when baseline (clickable when not authenticated to redirect)
  - Export/Share: disabled when baseline OR not authenticated

### Testing
- Signed out + has scan: Set Alert redirects to /login
- Signed in + no scan: buttons disabled with "Run a scan to activate"
- Signed in + scan: all buttons enabled, no confusing labels

## 3. Export Data ✅

### Implementation
- Already implemented in previous work:
  - `src/utils/exportScan.ts`: `prepareExportData()`, `exportAsJSON()`, `exportAsCSV()`
  - `src/components/ExportModal.tsx`: Modal to choose format
  - Handlers in `DashboardPage.tsx`: `handleExportData()`, `handleExportJSON()`, `handleExportCSV()`

### Testing
- Authenticated + has scan: Export Data opens modal, both formats download correctly

## 4. Share Report ✅

### Implementation
- Already implemented:
  - `shared_reports` table in `MASTER_SCHEMA.sql`
  - Edge Functions: `create-share`, `get-share`
  - `src/pages/ShareReportPage.tsx`: Public view route
  - Handler in `DashboardPage.tsx`: `handleShareReport()`

### Testing
- Authenticated + has scan: Share Report creates link and copies to clipboard
- Visit `/share/:token`: Should show read-only report

## 5. Alerts System ✅

### Schema Updates
- Updated `product_alerts` table in `MASTER_SCHEMA.sql`:
  - Added `user_email TEXT NOT NULL` (copy of auth email at creation)
  - Added `last_sent_at TIMESTAMPTZ` (for rate limiting)

### Edge Function Updates
- `create-alert/index.ts`:
  - Now includes `user_email` from `user.email` when creating alert
  - Validates email exists before creating

- `run-alerts/index.ts`:
  - Uses `alert.user_email` directly instead of fetching from profiles
  - Updates both `last_triggered_at` and `last_sent_at` on email send
  - Cooldown check uses `last_sent_at` if available

### UI Updates
- `src/pages/DashboardPage.tsx`:
  - Added toast confirmation: "Alert enabled for {query}" after successful creation

### Testing
- Create alert: Verify `user_email` is stored correctly in database
- Run evaluator manually: Verify email sends to `user_email`
- Rate limiting: Verify cooldown prevents duplicate emails

## 6. Extension Auth (Pending)

### Status
- Extension auth bridging exists in `src/services/authBridge.ts`
- Needs integration in extension popup/options
- Extension should:
  1. Show "Sign in" in options/panel
  2. Store session in `chrome.storage.sync`
  3. Include `Authorization` header in Edge Function calls when available
  4. Show "Sign in to enable alerts" when not authenticated

## Files Changed

### New Files
- `src/utils/scanKey.ts` - Stable scan key generation
- `DEV_NOTES.md` - This file

### Modified Files
- `src/store/scanStore.ts` - Deduplication logic
- `src/components/layout/Sidebar.tsx` - Recent scans display
- `src/ui/ProductIntelligencePanel.tsx` - Actions panel labels
- `src/pages/DashboardPage.tsx` - Alert success toast
- `supabase/migrations/MASTER_SCHEMA.sql` - Added user_email, last_sent_at
- `supabase/functions/create-alert/index.ts` - Include user_email
- `supabase/functions/run-alerts/index.ts` - Use user_email, update last_sent_at

## Build Status
✅ `npm run build` passes

## Next Steps
1. Test Recent Scans deduplication with multiple scans
2. Test Actions panel in all states (signed out, signed in, baseline, with scan)
3. Test Export/Share functionality
4. Test alert creation and email delivery
5. Implement extension auth bridging (if needed)

---

## Price Trends Fix: Real Data + Working Timeframe (2024-01-XX)

### Changes Summary
- Fixed Price Trends to use real scan history from `scan_trend_points` table
- Timeframe selection (7d/30d/90d/etc) now actually filters and redraws chart
- Removed double-filtering bug (data was filtered in fetch AND in buildChartSeries)
- Added AbortController to cancel in-flight requests when timeframe changes
- Removed fake/fallback data behavior
- Added proper empty/error states with actionable messages

### How Trends Work
1. **Data Source**: `scan_trend_points` table stores one point per successful scan
2. **On Scan Success**: If scan has real data (sample_size > 0), insert into `scan_trend_points` with:
   - query, scope, location_type/value
   - series JSONB: { msrp, national_used_avg, shippable_avg, local_avg }
3. **Trend Fetch**: `fetchTrendHistory()` queries `scan_trend_points` filtered by:
   - query + scope + location (matches current scan)
   - timeframe (created_at >= startDate based on timeframe)
   - user_id (if authenticated)
4. **Chart Rendering**: Only renders lines when >= 2 points exist for a series

### Testing Instructions

#### Quick Test (3+ scans)
1. Run a scan for query "book" (or any product)
2. Wait a few seconds, then run the same scan again (same query, same location)
3. Run it a third time
4. **Expected**: Chart should show 3 points connected by lines
5. Click timeframe buttons (7d → 30d → 90d → all)
6. **Expected**: Chart should update immediately, showing different point counts
7. Check meta text below chart: "Filtered: X points • Range: Y • Z scans"

#### Timeframe Filtering Test
1. With 3+ scans for same query:
   - Select "7d" → Should show only scans from last 7 days
   - Select "30d" → Should show scans from last 30 days (more points if scans are older)
   - Select "all" → Should show all scans
2. **Expected**: Point count in meta text changes, chart redraws

#### Empty State Test
1. Run only 1 scan for a query
2. **Expected**: Shows "Not enough history yet" with "Run another scan" button
3. No chart should render (no misleading single dot)

#### Error State Test
1. Disable Supabase (remove env vars temporarily)
2. **Expected**: Shows "Failed to load trends" with "Trends unavailable (backend not configured)" message
3. No fake data should appear

### Files Changed
- `src/services/trendHistory.ts` - Fetch from scan_trend_points with timeframe filtering
- `src/ui/ProductIntelligencePanel.tsx` - Use scan history, add AbortController, proper states
- `src/features/charts/buildSeries.ts` - Remove double-filtering, remove fake fallback data
- `src/ui/PriceChart.tsx` - Remove timeframe from deps (data pre-filtered)
- `src/features/scans/scanService.ts` - Insert into scan_trend_points on successful scan
- `supabase/migrations/20240102000000_add_scan_trend_points.sql` - Table schema

### Key Fixes
1. **Double-filtering removed**: Data is filtered once in `fetchTrendHistory`, not again in `buildChartSeries`
2. **Timeframe in request key**: Chart key includes timeframe, ensuring re-render on change
3. **AbortController**: Cancels in-flight requests when timeframe/location changes
4. **No fake data**: Removed fallback logic that showed single point when filtering removed all data
5. **Proper validation**: Only insert trend points when scan has real data (sample_size > 0)

---

## Real Trend Data Pipeline + Timeframe Fix (2024-01-XX)

### Changes Summary
- Created `scan_history` table for durable time-series storage
- Updated scan Edge Function to insert into `scan_history` on successful scans
- Rewrote `get-trends` Edge Function to fetch from `scan_history` (not external API)
- Fixed timeframe selection to actually filter and redraw chart
- Added data integrity badge (Verified/Unavailable/Error)
- Improved error messages with specific actionable text
- Fixed header overlap with 3-column grid layout
- Added proper empty states with CTAs

### Database Schema
- **Table**: `scan_history`
- **Columns**: id, created_at, user_id, user_email, scan_key, query, scope, location_key, sources[], msrp, national_used_avg, local_avg, shippable_avg, ebay_used_avg, sample_size, source_count, confidence
- **Indexes**: (scan_key, created_at DESC), (user_id, created_at DESC), (query, created_at DESC)

### How It Works
1. **On Scan Success**: Edge Function inserts one row into `scan_history` with computed metrics
2. **Trend Fetch**: `get-trends` Edge Function queries `scan_history` filtered by:
   - scan_key (query + scope + sources + location)
   - rangeDays (from timeframe: 7d=7, 30d=30, 90d=90, 180d=180, 1y=365, 2y=730, 5y=1825, all=null)
   - location_key (optional)
   - user_id (optional)
3. **Chart Rendering**: Only renders lines when >= 2 points exist for a series

### Testing Instructions

#### Quick Test (3+ scans)
1. Run a scan for query "book" (or any product)
2. Wait a few seconds, then run the same scan again (same query, same location)
3. Run it a third time
4. **Expected**: Chart should show 3 points connected by lines
5. Click timeframe buttons (7d → 30d → 90d → all)
6. **Expected**: Chart should update immediately, showing different point counts
7. Check meta text below chart: "Filtered: X points • Range: Y"

#### Timeframe Filtering Test
1. With 3+ scans for same query:
   - Select "7d" → Should show only scans from last 7 days
   - Select "30d" → Should show scans from last 30 days (more points if scans are older)
   - Select "all" → Should show all scans
2. **Expected**: Point count in meta text changes, chart redraws immediately

#### Empty State Test
1. Run only 1 scan for a query
2. **Expected**: Shows "History required" with "Run another scan" and "Enable Auto-Scan via Chrome Extension" buttons
3. No chart should render (no misleading single dot)

#### Error State Test
1. Disable Supabase (remove env vars temporarily)
2. **Expected**: Shows "Failed to load trends" with "Trends service not deployed" message
3. No fake data should appear

#### Data Integrity Badge Test
1. With real scan data: Badge shows "Verified" (green)
2. With no data: Badge shows "Unavailable" (gray)
3. With fetch error: Badge shows "Error" (red)

### Files Changed
- `supabase/migrations/20240103000000_add_scan_history.sql` - New table schema
- `supabase/functions/scan-product/index.ts` - Insert into scan_history on scan success
- `supabase/functions/get-trends/index.ts` - Rewritten to fetch from scan_history
- `src/lib/scanKey.ts` - New utility for computing stable scan_key
- `src/services/trends.ts` - New service to fetch from get-trends Edge Function
- `src/ui/ProductIntelligencePanel.tsx` - Use new trends service, add data integrity badge, fix error messages
- `src/components/layout/TopBar.tsx` - 3-column grid layout (already fixed)

### Key Improvements
1. **Real data only**: No fake/mock/placeholder data - shows honest empty states
2. **Timeframe works**: Changing timeframe immediately refetches and redraws chart
3. **Specific errors**: Error messages are actionable (e.g., "Not authorized — sign in", "Trends service not deployed")
4. **Data integrity badge**: Shows Verified/Unavailable/Error status
5. **Header fixed**: 3-column grid prevents overlap on desktop
6. **Mobile responsive**: Timeframe buttons wrap, location input works on mobile

---

## Header Overlap Fix + Real Price Trends (2024-01-XX)

### Changes Summary
- Fixed desktop header overlap with 3-column grid layout
- Created `price_points` table with `scan_key` for time-series tracking
- Updated scan Edge Function to insert price_points on successful scans
- Chart now fetches real data from `price_points` instead of scan history
- Added empty state when < 2 data points (no fake dots)
- Fixed timeframe filtering to actually filter and redraw chart

### Test Checklist

#### Desktop Header (1280px+ width)
- [ ] Search bar, location selector, and scan button are in middle column
- [ ] Pricing/Sign In/Sign Out buttons are in right column
- [ ] No overlap between columns at 1280px, 1440px, 1920px widths
- [ ] Debug button hidden on md, visible on lg+ (if applicable)
- [ ] Nav cluster wraps gracefully below 1024px if needed

#### Timeframe Filtering
- [ ] Clicking timeframe buttons (7d, 30d, 90d, etc.) immediately redraws chart
- [ ] Chart shows only data points within selected timeframe
- [ ] "Data depth: X scans • Range: Y" metadata updates when timeframe changes
- [ ] Switching from "all" to "7d" filters correctly
- [ ] Switching from "7d" to "30d" shows more points

#### Real Price Trends (No Fake Data)
- [ ] With only 1 scan: Chart shows empty state "Not enough history to draw trend"
- [ ] No isolated dots appear when < 2 points
- [ ] After 3+ scans over time: Lines appear on chart
- [ ] Chart lines connect points chronologically
- [ ] No "Sample market data shown" or mock data appears

#### Data Persistence
- [ ] Run a scan → Check Supabase `price_points` table → Record exists with correct `scan_key`
- [ ] Run same query again → New `price_points` record created with same `scan_key`
- [ ] Chart shows both points connected by a line
- [ ] `scan_key` format: `query|scope|sources|location_type:location_value`

#### Build & Type Safety
- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes (no type errors)
- [ ] No new lint errors in modified files

### Files Changed
- `src/components/layout/TopBar.tsx` - 3-column grid layout
- `supabase/migrations/20240101000000_add_price_points_scan_key.sql` - New table columns
- `supabase/functions/scan-product/index.ts` - Insert price_points on scan
- `src/services/pricePointsService.ts` - Fetch price_points by scan_key
- `src/ui/ProductIntelligencePanel.tsx` - Fetch real data, show data depth
- `src/ui/PriceChart.tsx` - Empty state when < 2 points, filter series

### Database Migration
Run in Supabase SQL Editor:
```sql
-- See: supabase/migrations/20240101000000_add_price_points_scan_key.sql
```

