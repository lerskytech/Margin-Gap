# MarginGap Chrome Extension

Ultra-fast price intelligence overlay for resellers. Right-click any product to check market value.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. Configure Supabase credentials (see Configuration below)

## Configuration

The extension needs Supabase credentials to function. Set them via:

1. Open extension options (right-click extension icon → Options)
2. Enter your Supabase URL and Anon Key
3. Click "Test Connection" to verify
4. Click "Save Settings"

## Usage

1. Navigate to Facebook Marketplace, Amazon, or Craigslist
2. **Highlight product name** (not just the price)
3. Right-click → "Check MarginGap"
4. Premium popup appears instantly with:
   - **Margin Gap** (hero metric with status indicator)
   - MSRP (if available)
   - National used average
   - Local average
   - Provenance: "Based on X listings across Y sources • updated Z"
   - Status indicator: ▲ Undervalued / ▼ Overpriced / ▬ At Market

## Features

### Premium UI
- Micro-card design with accent bar
- Skeleton loading states (<50ms perceived)
- Smooth animations and transitions
- Dark mode support

### Smart Selection
- Detects if you highlighted just a price (shows helpful hint)
- Normalizes text for better matching
- Works across Facebook, Amazon, Craigslist

### Fast Performance
- 10-minute cache for instant repeat queries
- Request deduplication (no duplicate API calls)
- Optimistic UI (shows loading immediately)

### Trust & Provenance
- Shows sample size and data sources
- Relative timestamps ("2m ago")
- Graceful "not enough data" states

## Architecture

### Files

- `manifest.json` - Extension configuration (MV3)
- `background.js` - Service worker (context menu, caching, API calls)
- `content.js` - Content script (DOM interaction, premium popup)
- `content.css` - Premium popup styles
- `options.html/js` - Settings page with validation
- `utils.js` - Utility functions (logger, normalizers)

### Data Flow

1. User highlights text → Right-clicks → "Check MarginGap"
2. Content script validates selection (rejects price-only)
3. Shows skeleton loading immediately
4. Background script checks cache (10min TTL)
5. If cache miss, calls Supabase Edge Function
6. Response includes optional `meta` and `provenance` fields
7. Content script renders premium popup
8. Popup auto-dismisses after 12s or on ESC/click outside/scroll

### API Integration

The extension calls the `scan-product` Supabase Edge Function:

```
POST /functions/v1/scan-product
{
  "query": "iPhone 13",
  "region_key": "US",
  "user_id": "optional-user-id"
}
```

Response includes optional fields:
```json
{
  "scan_id": "...",
  "query": "iPhone 13",
  "aggregates": [...],
  "verdict": {...},
  "meta": {
    "requestId": "...",
    "generatedAt": "...",
    "cacheHit": false,
    "providerStatuses": [...]
  },
  "provenance": {
    "totalListings": 150,
    "sources": [{"name": "ebay", "count": 150}],
    "updatedAt": "..."
  }
}
```

## Troubleshooting

**Popup doesn't appear:**
- Check browser console (F12) for errors
- Verify Supabase credentials are configured in Options
- Check Edge Function logs: `supabase functions logs scan-product`
- Ensure you're highlighting text (not just clicking)

**"Need Product Name" hint appears:**
- You highlighted just a price (e.g., "$120")
- Highlight the product title/name instead
- Example: "iPhone 13 128GB" not just "$120"

**"Unable to check price" or config errors:**
- Open extension Options (right-click extension icon → Options)
- Enter Supabase URL and Anon Key
- Click "Test Connection" to verify
- Ensure URL is HTTPS and includes "supabase" in hostname
- Key should be 50+ characters and include "."

**"Not enough data" error:**
- Product name may be too ambiguous
- Try a more specific product title
- Check Edge Function is deployed and working

**Slow response:**
- First request may be slow (cold start)
- Subsequent requests are cached for 10 minutes
- Check network tab for API response times
- Cached results show instantly

**Popup closes unexpectedly:**
- Popup auto-dismisses after 12 seconds of inactivity
- Also closes on: ESC key, click outside, or page scroll
- This is intentional to keep the UI non-intrusive

## Development

### Build

No build step required - extension uses vanilla JS.

### Testing

1. Load extension in Chrome (Developer mode)
2. Test on:
   - Facebook Marketplace: `https://www.facebook.com/marketplace`
   - Amazon: `https://www.amazon.com`
   - Craigslist: `https://sfbay.craigslist.org`

### Debugging

- Background script: `chrome://extensions/` → Extension → "Service worker" → Inspect
- Content script: Right-click page → Inspect → Console tab
- Popup: Inspect popup element in DOM

## TODOs

### Phase 1 (MVP) - ✅ Complete
- ✅ Context menu integration
- ✅ Premium popup UI
- ✅ Supabase Edge Function integration
- ✅ Caching and request deduplication
- ✅ Smart selection parsing
- ✅ Options page with validation
- ✅ Error handling
- ✅ Loading states

### Phase 2 (Enhancements)
- [ ] Add more providers (Facebook, Amazon, Craigslist parsing)
- [ ] Better price extraction from page context
- [ ] Region inference from page context
- [ ] Watchlist sync (if logged in)
- [ ] Price alerts

### Phase 3 (Features)
- [ ] Mini chart in popup
- [ ] Quick actions (save to watchlist, set alert)
- [ ] Keyboard shortcuts
- [ ] Offline mode (cached results)

### Phase 4 (Polish)
- [ ] Better error messages
- [ ] Animation improvements
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Analytics (optional)

## Security

- Extension only requests data, never modifies pages
- No scraping accounts or automation
- All API calls go through Supabase (secure)
- User data stored locally (no external tracking)
- Supabase anon key only (service role stays server-only)

## License

Same as main MarginGap project.
