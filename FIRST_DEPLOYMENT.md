# First Deployment to Vercel

## Step 1: Connect GitHub Repository to Vercel

1. Go to: **https://vercel.com/skyler-kellys-projects/margingap**
2. Click **"Connect Git"** or **"Settings" → "Git"**
3. Select **GitHub** as your Git provider
4. Authorize Vercel to access your GitHub account (if needed)
5. Select repository: **`lerskytech/Margin-Gap`**
6. Click **Import**

## Step 2: Configure Project Settings

Vercel should auto-detect:
- **Framework Preset:** Vite
- **Root Directory:** `./` (root)
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

If not auto-detected, manually set:
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

## Step 3: Add Environment Variables (BEFORE FIRST DEPLOY)

**IMPORTANT:** Add these BEFORE clicking Deploy:

1. Click **"Environment Variables"** section
2. Add **Variable 1:**
   - Key: `VITE_SUPABASE_URL`
   - Value: `https://mjjxvmumjfvlpfnkwzko.supabase.co`
   - Environments: ✅ Production ✅ Preview ✅ Development
3. Add **Variable 2:**
   - Key: `VITE_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qanh2bXVtamZ2bHBmbmt3emtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NjU5ODAsImV4cCI6MjA4MzM0MTk4MH0.oSCfg_AQmFMbON2jrrMxfxGrghlC3kgg_I4ZbheoZpU`
   - Environments: ✅ Production ✅ Preview ✅ Development

## Step 4: Deploy

1. Click **"Deploy"** button
2. Wait for build to complete (2-3 minutes)
3. Your site will be live at: `https://margingap.vercel.app` (or your custom domain)

## Step 5: Add Custom Domain (margingap.com)

1. Go to **Settings → Domains**
2. Click **"Add Domain"**
3. Enter: `margingap.com`
4. Follow DNS configuration instructions:
   - Add the CNAME or A record as shown
   - Wait for DNS propagation (can take a few minutes to 48 hours)
5. Once DNS is verified, your site will be live at `https://margingap.com`

## Step 6: Post-Deployment Configuration

After deployment, update:

### Supabase Redirect URLs
- Go to **Supabase Dashboard → Authentication → URL Configuration**
- Add: `https://margingap.com/auth/callback`
- Add: `https://margingap.com`
- Update Site URL: `https://margingap.com`

### Google OAuth (if using)
- Go to **Google Cloud Console → Your OAuth Client**
- Add: `https://margingap.com` to Authorized JavaScript origins
- Add: `https://margingap.com/auth/callback` to Authorized redirect URIs

## Troubleshooting

### "No deployments found"
- Make sure GitHub repo is connected
- Check that `main` branch exists
- Try clicking "Redeploy" or trigger a new deployment

### Build fails
- Check build logs in Vercel Dashboard
- Verify `package.json` has correct scripts
- Ensure all dependencies are in `package.json`

### Environment variables not working
- Verify variables start with `VITE_` prefix
- Check they're added to all environments
- Redeploy after adding variables

## Quick Deploy via CLI (Alternative)

If you prefer CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (follow prompts)
vercel

# Link to existing project
vercel link

# Deploy to production
vercel --prod
```

## Next Steps After Deployment

1. ✅ Test the live site
2. ✅ Verify authentication works
3. ✅ Test Google OAuth (if configured)
4. ✅ Update Supabase redirect URLs
5. ✅ Update Google OAuth redirect URIs
6. ✅ Submit sitemap to Google Search Console

Your site will be live at: **https://margingap.com** (after DNS setup)

