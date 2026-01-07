# Timeframe Filtering - Testing Checklist

## Manual Testing Steps

### Prerequisites
1. Run at least 2 scans for the same product query (spaced at least a few minutes apart)
2. Ensure scans have different timestamps (or manually verify stored timestamps are distinct)

### Test Cases

#### 1. Timeframe Selection Updates Chart
- **Steps:**
  1. Open the dashboard with a product that has scan history
  2. Click different timeframe pills (7d, 30d, 90d, 180d, 1y, 2y, 5y, All)
  3. Observe the Price Trends chart
  
- **Expected:**
  - Chart X-axis range changes to match selected timeframe
  - Visible data points are filtered by the timeframe
  - X-axis domain adjusts automatically to show only filtered data
  - Chart re-renders smoothly without flicker

#### 2. Not Enough Data Handling
- **Steps:**
  1. Open a product with only 1 scan result
  2. Try switching between different timeframes
  
- **Expected:**
  - Timeframe buttons still visually select (no errors)
  - Small inline hint appears in Price Trends header: "Timeframe won't change until we have more than one scan saved for this product."
  - Chart still displays the single point
  - No error messages or blank screens

#### 3. Memoization Dependencies
- **Steps:**
  1. Open browser DevTools
  2. Switch between timeframes multiple times
  3. Check console for any unnecessary re-renders (in DEV mode)
  
- **Expected:**
  - No duplicate re-renders when timeframe doesn't change
  - Chart data recomputes only when timeframe changes
  - No console errors

#### 4. Edge Cases
- **All Timeframe:**
  - Select "All" timeframe
  - Chart should show all available data points
  
- **Single Point After Filtering:**
  - Filter data such that only 1 point remains
  - Chart should still display (may show limited history message)
  
- **No Data:**
  - Filter data such that no points remain
  - Chart should show empty state message

#### 5. Location + Timeframe Combination
- **Steps:**
  1. Select a local location (ZIP or City)
  2. Switch between different timeframes
  3. Verify chart updates correctly
  
- **Expected:**
  - Chart key includes both location and timeframe
  - Filtering works correctly with location-specific data
  - No conflicts between location and timeframe filtering

### Verification Points

- ✅ Timeframe buttons visually select when clicked
- ✅ Chart X-axis range updates to reflect timeframe
- ✅ Data points are filtered correctly by timestamp
- ✅ Chart re-renders when timeframe changes
- ✅ No duplicate points appear
- ✅ No blank screens
- ✅ "Not enough data" hint appears when appropriate
- ✅ Build passes: `npm run build`
- ✅ TypeScript passes: `npx tsc --noEmit`

### Technical Notes

- Timeframe filtering uses `filterPointsByTimeframe` utility from `src/utils/timeframe.ts`
- Filtering is applied in `buildChartSeries` function before building chart series
- Chart key includes: `${scan_id}-${timeframe}-${location}` to force re-render
- X-axis domain is set to `['dataMin', 'dataMax']` for automatic range adjustment
- Memoization dependencies include `timeframe` to ensure recomputation

