# Vercel Environment Variables Troubleshooting

## Issue: "Auth is disabled — configure Supabase env vars"

If you're seeing this message in production, it means Vercel isn't reading your environment variables correctly.

## Quick Fix Checklist

### 1. Verify Variables Are Set in Vercel

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Check that these exist:
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_ANON_KEY`

### 2. Check Variable Names

**CRITICAL:** Variables MUST start with `VITE_` prefix:
- ✅ Correct: `VITE_SUPABASE_URL`
- ❌ Wrong: `SUPABASE_URL` (missing VITE_ prefix)

### 3. Check All Environments

Make sure variables are added to **ALL** environments:
- ✅ Production
- ✅ Preview  
- ✅ Development

### 4. Verify Values

**VITE_SUPABASE_URL** should be:
```
https://mjjxvmumjfvlpfnkwzko.supabase.co
```

**VITE_SUPABASE_ANON_KEY** should be:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qanh2bXVtamZ2bHBmbmt3emtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NjU5ODAsImV4cCI6MjA4MzM0MTk4MH0.oSCfg_AQmFMbON2jrrMxfxGrghlC3kgg_I4ZbheoZpU
```

### 5. Redeploy After Adding Variables

**IMPORTANT:** After adding/updating environment variables:
1. Go to **Deployments** tab
2. Click the **three dots** (⋯) on the latest deployment
3. Click **Redeploy**
4. Wait for deployment to complete

Environment variables are only available **after redeploy**.

## Common Mistakes

### ❌ Variable name without VITE_ prefix
```
SUPABASE_URL=...  ❌ Won't work
VITE_SUPABASE_URL=...  ✅ Correct
```

### ❌ Only added to Production
- Variables must be in all environments OR
- At minimum, add to Production

### ❌ Forgot to redeploy
- Variables are injected at build time
- Must redeploy after adding variables

### ❌ Extra spaces or quotes
```
VITE_SUPABASE_URL = "https://..."  ❌ Has spaces and quotes
VITE_SUPABASE_URL=https://...  ✅ Correct
```

## How to Verify Variables Are Working

### Method 1: Check Browser Console

1. Open your deployed app
2. Open browser DevTools (F12)
3. Go to Console tab
4. Look for: `Missing Supabase environment variables` warning
   - If you see this → variables not set
   - If you don't see it → variables are set ✅

### Method 2: Check Network Tab

1. Open browser DevTools → Network tab
2. Look for requests to `*.supabase.co`
   - If you see requests → Supabase is configured ✅
   - If no requests → variables not set

### Method 3: Dev Mode Debug Panel

If you're in dev mode, the login page shows a debug panel with env var status.

## Step-by-Step Fix

1. **Go to Vercel Dashboard**
   - https://vercel.com/skyler-kellys-projects/margin-gap-9cd1
   - Or your project dashboard

2. **Navigate to Settings → Environment Variables**

3. **Add Variable 1:**
   - Key: `VITE_SUPABASE_URL`
   - Value: `https://mjjxvmumjfvlpfnkwzko.supabase.co`
   - Environments: ✅ Production ✅ Preview ✅ Development
   - Click **Save**

4. **Add Variable 2:**
   - Key: `VITE_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qanh2bXVtamZ2bHBmbmt3emtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NjU5ODAsImV4cCI6MjA4MzM0MTk4MH0.oSCfg_AQmFMbON2jrrMxfxGrghlC3kgg_I4ZbheoZpU`
   - Environments: ✅ Production ✅ Preview ✅ Development
   - Click **Save**

5. **Redeploy:**
   - Go to **Deployments** tab
   - Click **⋯** on latest deployment
   - Click **Redeploy**
   - Wait for build to complete

6. **Test:**
   - Visit your production URL
   - "Auth is disabled" message should disappear
   - Google sign-in button should be enabled

## Still Not Working?

### Check Build Logs

1. Go to **Deployments** → Click on a deployment
2. Check **Build Logs**
3. Look for errors related to environment variables

### Verify in Code

The app checks for variables in `src/services/supabase.ts`:
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabaseEnabled = !!(supabaseUrl && supabaseAnonKey)
```

If `supabaseEnabled` is `false`, the variables aren't being read.

### Contact Support

If variables are set correctly and you've redeployed but still not working:
- Check Vercel status page
- Review Vercel documentation
- Contact Vercel support with deployment logs

## OAuth-Specific Issues

If auth is enabled but OAuth still fails:

1. **Check Supabase Dashboard:**
   - Authentication → Providers → Google
   - Verify "Enable Google provider" is ON
   - Verify Client ID and Secret are saved

2. **Check Redirect URLs:**
   - Supabase: `https://margingap.com/auth/callback`
   - Google Console: `https://margingap.com/auth/callback`

3. **Check Error Message:**
   - Look for specific error in browser console
   - Check the debug panel on login page (dev mode)
   - Review `lastAuthError` in the UI

