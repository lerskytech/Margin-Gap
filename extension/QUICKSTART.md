# Quick Start Guide

## 1. Deploy Edge Function

```bash
cd supabase/functions/scan-product
supabase functions deploy scan-product
```

## 2. Load Extension

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `extension` folder

## 3. Configure

1. Click the extension icon → "Options"
2. Enter your Supabase credentials:
   - **URL**: `https://your-project.supabase.co`
   - **Anon Key**: Your Supabase anonymous key (from project settings)

## 4. Test

1. Go to Facebook Marketplace: https://www.facebook.com/marketplace
2. Find a product listing
3. Highlight the product name or price
4. Right-click → "Check MarginGap"
5. Popup should appear with price intelligence

## Troubleshooting

**Popup doesn't appear:**
- Check browser console (F12) for errors
- Verify Supabase credentials are correct
- Check Edge Function logs: `supabase functions logs scan-product`

**"Unable to check price" error:**
- Product name may be too ambiguous
- Try highlighting a clearer product title
- Check Edge Function is deployed and working

**Slow response:**
- First request may be slow (cold start)
- Subsequent requests should be faster
- Check network tab for API response times

## Next Steps

- Add icons (see `icons/README.md`)
- Test on Amazon and Craigslist
- Customize popup styling if needed
- Add rate limiting (see `DEPLOYMENT.md`)

