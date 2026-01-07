# Fix: OAuth Redirecting to localhost Instead of Production

## Problem

After Google OAuth completes, it tries to redirect to `localhost` instead of `https://margingap.com`, causing:
```
ERR_CONNECTION_REFUSED
This site can't be reached
localhost refused to connect
```

## Root Cause

Supabase is configured to redirect to `localhost` instead of your production domain. This happens in **Supabase Dashboard** → **Authentication** → **URL Configuration**.

---

## Quick Fix

### Step 1: Update Supabase Site URL

1. Go to: **https://supabase.com/dashboard/project/mjjxvmumjfvlpfnkwzko**
2. Navigate to: **Authentication** → **URL Configuration**
3. Find **"Site URL"** field
4. Change it from `http://localhost:5179` (or whatever localhost URL) to:
   ```
   https://margingap.com
   ```
5. Click **Save**

### Step 2: Update Additional Redirect URLs

In the same page, find **"Additional Redirect URLs"** and make sure it includes:

```
https://margingap.com/auth/callback
https://margingap.com
https://www.margingap.com/auth/callback
https://www.margingap.com
```

**Remove any localhost URLs** from this list (or keep them if you still want local dev to work).

### Step 3: Save and Test

1. Click **Save**
2. Wait 1-2 minutes for changes to propagate
3. Try signing in with Google again
4. Should now redirect to `https://margingap.com/auth/callback` instead of localhost

---

## Why This Happens

When you call `signInWithGoogle()`, Supabase uses:
1. The `redirectTo` parameter you pass (if any)
2. OR the **Site URL** from Supabase Dashboard
3. OR the **Additional Redirect URLs** if they match

If your Site URL is still set to `localhost`, Supabase will try to redirect there even in production.

---

## Code Check

The code in `src/services/auth.ts` uses:
```typescript
redirectTo: redirectTo || `${window.location.origin}/auth/callback`
```

This should automatically use the current domain (`margingap.com` in production), but Supabase might be overriding it with the Site URL setting.

---

## Complete Supabase Configuration

### Site URL
```
https://margingap.com
```

### Additional Redirect URLs (one per line)
```
https://margingap.com/auth/callback
https://margingap.com
https://www.margingap.com/auth/callback
https://www.margingap.com
http://localhost:5179/auth/callback
http://localhost:5179
http://localhost:5173/auth/callback
http://localhost:5173
```

**Note**: You can keep localhost URLs if you want local development to still work.

---

## Verify It's Fixed

After updating Supabase:

1. **Clear browser cache** (or use incognito)
2. Go to: `https://margingap.com/login`
3. Click "Sign in with Google"
4. Complete Google authentication
5. Should redirect to: `https://margingap.com/auth/callback` ✅
6. Then redirect to: `https://margingap.com/` (dashboard) ✅

---

## If Still Not Working

### Check 1: Browser Console
Open DevTools → Console and look for any errors or redirect URLs being logged.

### Check 2: Network Tab
Check the Network tab to see what URL Supabase is trying to redirect to.

### Check 3: Supabase Logs
1. Go to Supabase Dashboard → **Logs** → **Auth Logs**
2. Look for recent OAuth attempts
3. Check what redirect URL was used

### Check 4: Environment Variables
Make sure your production build has:
- `VITE_SUPABASE_URL=https://mjjxvmumjfvlpfnkwzko.supabase.co`
- `VITE_SUPABASE_ANON_KEY=your_anon_key`

---

## Summary

**The fix**: Change Supabase Dashboard → Authentication → URL Configuration → **Site URL** from `localhost` to `https://margingap.com`

That's it! 🎉

