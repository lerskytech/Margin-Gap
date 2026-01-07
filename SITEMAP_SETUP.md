# Sitemap Setup for Google Search Console

## Update Your Domain

1. Edit `public/sitemap.xml`
2. Replace `YOUR_DOMAIN.com` with your actual domain (e.g., `margin-gap.com` or `www.margin-gap.com`)
3. Save and commit the changes

## Example

If your domain is `margin-gap.com`, the sitemap URLs should be:
- `https://margin-gap.com/`
- `https://margin-gap.com/pricing`
- `https://margin-gap.com/login`
- `https://margin-gap.com/signup`

## Submit to Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select your property (add your domain if not already added)
3. Navigate to **Sitemaps** in the left menu
4. Enter: `sitemap.xml`
5. Click **Submit**

Your sitemap URL will be:
```
https://YOUR_DOMAIN.com/sitemap.xml
```

## Verify Sitemap is Accessible

Before submitting, verify your sitemap is accessible:
- Visit: `https://YOUR_DOMAIN.com/sitemap.xml`
- You should see the XML sitemap content
- If you see 404, ensure the file is in the `public/` folder and has been deployed

## After Domain Update

After updating the sitemap with your domain:
1. Commit and push to GitHub
2. Vercel will auto-deploy
3. Wait for deployment to complete
4. Verify sitemap is accessible at `https://YOUR_DOMAIN.com/sitemap.xml`
5. Submit to Google Search Console

