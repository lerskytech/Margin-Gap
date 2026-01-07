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

