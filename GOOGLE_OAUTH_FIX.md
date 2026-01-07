# Fix Google OAuth "redirect_uri_mismatch" Error

## Error Message
```
Error 400: redirect_uri_mismatch
Access blocked: This app's request is invalid
```

## Root Cause

Google Cloud Console is missing the Supabase callback URL in the **Authorized redirect URIs**.

## Quick Fix (5 minutes)

### Step 1: Go to Google Cloud Console

1. Open: https://console.cloud.google.com/
2. Select your project
3. Navigate to: **APIs & Services** → **Credentials**
4. Find your **OAuth 2.0 Client ID** (the one you're using for MarginGap)
5. Click **Edit** (pencil icon)

### Step 2: Add Supabase Callback URL

In the **Authorized redirect URIs** section, make sure you have:

```
https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback
```

**This is the CRITICAL one** - Google must have this exact URL.

Also add your production domain (if testing on production):
```
https://margingap.com/auth/callback
https://www.margingap.com/auth/callback
```

And local development URLs (if testing locally):
```
http://localhost:5179/auth/callback
http://localhost:5173/auth/callback
```

### Step 3: Save

Click **Save** at the bottom.

### Step 4: Wait 1-2 Minutes

Google may take a minute or two to propagate the changes.

### Step 5: Test Again

Try signing in with Google again. It should work now!

---

## Complete List of Required Redirect URIs

Copy and paste these into Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs:

```
https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback
https://margingap.com/auth/callback
https://www.margingap.com/auth/callback
http://localhost:5179/auth/callback
http://localhost:5173/auth/callback
```

**Important Notes:**
- The Supabase callback (`https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback`) is **REQUIRED**
- The app callbacks (`https://margingap.com/auth/callback`) are optional but recommended
- Local URLs are only needed for development

---

## How OAuth Flow Works

1. User clicks "Sign in with Google" on `https://margingap.com`
2. App calls Supabase: `signInWithOAuth({ provider: 'google', redirectTo: 'https://margingap.com/auth/callback' })`
3. Supabase redirects to Google with callback: `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback`
4. **Google checks if this URL is in Authorized redirect URIs** ← This is where it's failing
5. User authenticates with Google
6. Google redirects to Supabase: `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback`
7. Supabase processes OAuth, creates session
8. Supabase redirects to app: `https://margingap.com/auth/callback`
9. App handles callback, user is signed in

---

## Verify Configuration

### In Google Cloud Console:
- ✅ `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback` is in Authorized redirect URIs

### In Supabase Dashboard:
1. Go to: **Authentication** → **URL Configuration**
2. **Site URL** should be: `https://margingap.com` (or your production domain)
3. **Additional Redirect URLs** should include:
   ```
   https://margingap.com/auth/callback
   https://margingap.com
   https://www.margingap.com/auth/callback
   https://www.margingap.com
   ```

---

## Still Not Working?

### Check 1: Exact URL Match
- URLs must match **exactly** (no trailing slashes, correct protocol)
- `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback` ✅
- `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback/` ❌ (trailing slash)

### Check 2: Wait for Propagation
- Google changes can take 1-5 minutes
- Try clearing browser cache
- Try incognito/private window

### Check 3: Verify Supabase Configuration
- Go to Supabase Dashboard → Authentication → Providers
- Ensure Google provider is **enabled**
- Verify Client ID and Secret are correct

### Check 4: Check Browser Console
- Open browser DevTools → Console
- Look for any error messages
- Check Network tab for failed requests

---

## Quick Test

After adding the redirect URI, test with:

```bash
# This should redirect to Google (not show error)
curl -I "https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/authorize?provider=google"
```

If you see a redirect to `accounts.google.com`, it's working!

---

## Summary

**The fix:** Add `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback` to Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs.

That's it! 🎉

