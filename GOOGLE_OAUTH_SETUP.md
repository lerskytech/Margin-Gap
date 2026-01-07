# Google OAuth Setup Guide

This guide provides step-by-step instructions for configuring Google OAuth authentication with Supabase.

## Prerequisites

- Supabase project created and linked
- Google Cloud Console project with OAuth 2.0 credentials
- Frontend app running (default: `http://localhost:5179`)

---

## Part 1: Supabase Dashboard Configuration

### Step 1: Enable Google Provider

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** in the list and click to expand
5. Toggle **Enable Google provider** to ON
6. You'll need to add:
   - **Client ID (for OAuth)**: Your Google OAuth 2.0 Client ID
   - **Client Secret (for OAuth)**: Your Google OAuth 2.0 Client Secret
   - Click **Save**

### Step 2: Configure URL Settings

1. Still in **Authentication**, go to **URL Configuration**
2. Set **Site URL**:
   - For local development: `http://localhost:5179`
   - For production: Your production domain (e.g., `https://yourapp.com`)
3. Add **Additional Redirect URLs** (one per line):
   ```
   http://localhost:5179/auth/callback
   http://localhost:5179
   http://localhost:5173/auth/callback
   http://localhost:5173
   ```
   > **Note**: Include both port 5179 (Vite default) and 5173 (common alternative) if you use different ports
4. Click **Save**

---

## Part 2: Google Cloud Console Configuration

### Step 1: Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen first:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in required fields (App name, User support email, Developer contact)
   - Add scopes: `email`, `profile`, `openid`
   - Add test users if in testing mode
6. Back to Credentials, select **Web application**
7. Fill in:
   - **Name**: e.g., "Price Intel Scanner OAuth"
   - **Authorized JavaScript origins**:
     ```
     http://localhost:5179
     http://localhost:5173
     ```
     (Add your production domain when ready)
   - **Authorized redirect URIs** (CRITICAL - must include Supabase callback):
     ```
     https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback
     http://localhost:5179/auth/callback
     http://localhost:5173/auth/callback
     ```
     > **Note**: Your Supabase project reference is `mjjxvmumjfvlpfnkwzko`
8. Click **Create**
9. Copy the **Client ID** and **Client Secret** (you'll need these for Supabase)

### Step 2: Add Supabase Callback URL

The most critical redirect URI is:
```
https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback
```

This is where Google redirects after authentication, and Supabase handles the OAuth flow before redirecting to your app.

---

## Part 3: Common Issues & Troubleshooting

### Error: 400 Bad Request

**Causes:**
1. **Wrong redirect URI in Google Console**
   - Verify `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback` is in Authorized redirect URIs
   - Check for typos, missing `https://`, or trailing slashes

2. **Missing redirect URL in Supabase**
   - Ensure `http://localhost:5179/auth/callback` is in Additional Redirect URLs
   - Check Site URL matches your dev server port

3. **Provider not enabled**
   - Verify Google provider is enabled in Supabase Dashboard
   - Check Client ID and Secret are saved correctly

4. **Port mismatch**
   - If your app runs on port 5173, add that to both Supabase and Google Console
   - Check `vite.config.ts` for custom port configuration

### Error: Redirect URI mismatch

This means the redirect URI in the OAuth request doesn't match what's configured in Google Console. Check:
- Supabase redirect URL configuration
- Google Console Authorized redirect URIs
- Your app's `signInWithGoogle()` redirectTo parameter

### Error: Invalid client

- Verify Client ID and Secret are correct in Supabase Dashboard
- Check for extra spaces or copy/paste errors
- Ensure you're using the correct OAuth 2.0 Client ID (not API key)

---

## Part 4: Verification Checklist

After configuration, verify the flow works:

1. ✅ **Start your dev server**: `npm run dev`
2. ✅ **Navigate to login page**: `http://localhost:5179/login`
3. ✅ **Click "Continue with Google"**
4. ✅ **Verify redirect to Google**: Browser should redirect to `accounts.google.com`
5. ✅ **Sign in with Google**: Complete Google authentication
6. ✅ **Verify callback**: Browser should redirect to `http://localhost:5179/auth/callback`
7. ✅ **Verify dashboard**: Should automatically redirect to dashboard (`/`)
8. ✅ **Verify session**: User should be signed in, profile loaded

### Quick Test Commands

```bash
# Check if Supabase is configured
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# Verify redirect URL in code
grep -r "auth/callback" src/
```

---

## Part 5: Production Setup

When deploying to production:

1. **Update Supabase Site URL**:
   - Change to your production domain: `https://yourapp.com`

2. **Update Supabase Additional Redirect URLs**:
   - Add: `https://yourapp.com/auth/callback`
   - Add: `https://yourapp.com`

3. **Update Google Console**:
   - Add production domain to Authorized JavaScript origins
   - Add production callback to Authorized redirect URIs
   - Note: The Supabase callback URL (`https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback`) remains the same

4. **Update Environment Variables**:
   - Ensure production build uses correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

---

## Reference: OAuth Flow

```
User clicks "Sign in with Google"
  ↓
Frontend calls: supabase.auth.signInWithOAuth({ provider: 'google' })
  ↓
Supabase redirects to: accounts.google.com
  ↓
User authenticates with Google
  ↓
Google redirects to: https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback
  ↓
Supabase processes OAuth code, creates session
  ↓
Supabase redirects to: http://localhost:5179/auth/callback
  ↓
AuthCallbackPage checks session, redirects to: /
  ↓
User is signed in
```

---

## Support

If you encounter issues:
1. Check browser console for errors
2. Check Supabase Dashboard → Authentication → Logs
3. Verify all URLs match exactly (no trailing slashes, correct protocol)
4. Ensure environment variables are set correctly
5. Restart dev server after changing environment variables

