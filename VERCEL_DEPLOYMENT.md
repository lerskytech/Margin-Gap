# Vercel Deployment Guide

## Prerequisites

- GitHub repository connected to Vercel
- Supabase project configured
- Environment variables ready

## Step 1: Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New Project**
3. Import your GitHub repository: `lerskytech/Margin-Gap`
4. Vercel will auto-detect Vite configuration

## Step 2: Configure Build Settings

Vercel should auto-detect:
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

If not auto-detected, use the settings from `vercel.json`.

## Step 3: Add Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

### Required Variables

```
VITE_SUPABASE_URL=https://mjjxvmumjfvlpfnkwzko.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### How to Add:

1. Go to **Settings** → **Environment Variables**
2. Click **Add New**
3. For each variable:
   - **Key:** `VITE_SUPABASE_URL`
   - **Value:** Your Supabase URL
   - **Environment:** Production, Preview, Development (select all)
4. Repeat for `VITE_SUPABASE_ANON_KEY`
5. Click **Save**

## Step 4: Update Supabase Redirect URLs

After deployment, update Supabase to allow your production domain:

1. Go to Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add to **Additional Redirect URLs:**
   ```
   https://your-app.vercel.app/auth/callback
   https://your-app.vercel.app
   ```
3. Update **Site URL** to your production domain
4. Click **Save**

## Step 5: Update Google OAuth (if using)

1. Go to Google Cloud Console → Your OAuth Client
2. Add to **Authorized JavaScript origins:**
   ```
   https://your-app.vercel.app
   ```
3. Add to **Authorized redirect URIs:**
   ```
   https://your-app.vercel.app/auth/callback
   ```
4. Save changes

## Step 6: Deploy

1. Push to `main` branch (auto-deploys)
2. Or manually trigger from Vercel Dashboard
3. Wait for build to complete
4. Visit your deployment URL

## Post-Deployment Checklist

- [ ] Environment variables set in Vercel
- [ ] Supabase redirect URLs updated with production domain
- [ ] Google OAuth redirect URIs updated (if using)
- [ ] Test authentication flow on production
- [ ] Test Google OAuth on production
- [ ] Verify Edge Functions are accessible (if using)

## Custom Domain (Optional)

1. Go to Vercel Dashboard → Your Project → **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update Supabase and Google OAuth with new domain

## Troubleshooting

### Build Fails

- Check build logs in Vercel Dashboard
- Verify `package.json` has correct build script
- Ensure all dependencies are in `package.json` (not just devDependencies)

### Environment Variables Not Working

- Verify variables start with `VITE_` prefix
- Check they're added to all environments (Production, Preview, Development)
- Redeploy after adding variables

### OAuth Redirect Errors

- Verify redirect URLs match exactly (no trailing slashes)
- Check both Supabase and Google Console configurations
- Ensure production domain is added to all redirect URL lists

### 404 on Routes

- Verify `vercel.json` has SPA rewrite rule
- Check that `dist/index.html` exists after build

## Vercel CLI (Alternative)

You can also deploy via CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

## Continuous Deployment

Vercel automatically deploys:
- **Production:** Pushes to `main` branch
- **Preview:** Pull requests and other branches

No additional configuration needed!

