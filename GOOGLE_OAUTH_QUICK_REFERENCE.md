# Google OAuth - Supabase Configuration Quick Reference

## Supabase Dashboard Fields

When configuring Google OAuth in **Supabase Dashboard → Authentication → Providers → Google**, use these values:

### 1. Client IDs
**What to enter:** Your Google OAuth 2.0 Client ID (from Google Cloud Console)

**Format:** Single Client ID (comma-separated if you have multiple)
```
123456789-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com
```

**Where to find it:**
- Google Cloud Console → APIs & Services → Credentials
- Find your OAuth 2.0 Client ID (Web application type)
- Copy the **Client ID** value (not the Client Secret)

**Note:** For most apps, you only need one Client ID. The "comma-separated" option is for advanced use cases with multiple client IDs (e.g., different IDs for web vs mobile).

---

### 2. Client Secret (for OAuth)
**What to enter:** Your Google OAuth 2.0 Client Secret

**Format:** A long string like:
```
GOCSPX-abcdefghijklmnopqrstuvwxyz123456
```

**Where to find it:**
- Same location as Client ID (Google Cloud Console → Credentials)
- Click on your OAuth 2.0 Client ID
- Copy the **Client secret** value
- ⚠️ **Important:** If you don't see the secret, you may need to create a new one or reset it

**Security:** This is sensitive - never commit to git or expose in frontend code.

---

### 3. Skip nonce checks
**Recommended:** Leave **UNCHECKED** (default)

**When to enable:** Only if you're having issues with nonce validation and you understand the security implications. Generally not needed for standard web OAuth flows.

---

### 4. Allow users without an email
**Recommended:** Leave **UNCHECKED** (default)

**When to enable:** Only if you need to support Google accounts that don't have an email address (rare). Most Google accounts have emails, so this is usually unnecessary.

---

### 5. Callback URL (for OAuth)
**Value (already set by Supabase):**
```
https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback
```

**Action required:** 
- ✅ Copy this URL
- Go to **Google Cloud Console → Credentials → Your OAuth 2.0 Client ID**
- Add this URL to **Authorized redirect URIs**
- Click **Save**

---

## Step-by-Step: Getting Your Google OAuth Credentials

### Step 1: Create OAuth 2.0 Credentials in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
5. If prompted, configure OAuth consent screen first:
   - Choose **External** (unless you have Google Workspace)
   - Fill in: App name, User support email, Developer contact
   - Add scopes: `email`, `profile`, `openid`
   - Save and continue

### Step 2: Create OAuth Client ID

1. Application type: **Web application**
2. Name: e.g., "Price Intel Scanner"
3. **Authorized JavaScript origins:**
   ```
   http://localhost:5179
   http://localhost:5173
   ```
   (Add your production domain when ready)

4. **Authorized redirect URIs:**
   ```
   https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback
   http://localhost:5179/auth/callback
   http://localhost:5173/auth/callback
   ```

5. Click **Create**

### Step 3: Copy Credentials

After creation, you'll see:
- **Client ID:** `123456789-xxxxx.apps.googleusercontent.com` ← Copy this for Supabase "Client IDs"
- **Client secret:** `GOCSPX-xxxxx` ← Copy this for Supabase "Client Secret"

⚠️ **Note:** The Client secret is only shown once. If you lose it, you'll need to create a new one.

---

## Complete Supabase Configuration

Once you have your Google credentials, fill in Supabase:

```
✅ Enable Sign in with Google: ON

Client IDs:
[Paste your Client ID here]
Example: 123456789-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com

Client Secret (for OAuth):
[Paste your Client Secret here]
Example: GOCSPX-abcdefghijklmnopqrstuvwxyz123456

Skip nonce checks: ☐ (leave unchecked)

Allow users without an email: ☐ (leave unchecked)

Callback URL (for OAuth):
https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback
(This is auto-filled, just copy it to Google Console)
```

---

## Verification Checklist

After configuration:

- [ ] Client ID copied from Google Cloud Console
- [ ] Client Secret copied from Google Cloud Console
- [ ] Supabase "Client IDs" field filled
- [ ] Supabase "Client Secret" field filled
- [ ] Callback URL added to Google Console "Authorized redirect URIs"
- [ ] Local dev URLs added to Google Console "Authorized JavaScript origins"
- [ ] Clicked "Save" in Supabase Dashboard
- [ ] Tested sign-in flow: Login page → Google button → Google auth → Callback → Dashboard

---

## Troubleshooting

### "Invalid client" error
- Verify Client ID and Secret are correct (no extra spaces)
- Ensure you're using the OAuth 2.0 Client ID (not API key)

### "Redirect URI mismatch" error
- Verify callback URL is exactly: `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback`
- Check it's added in Google Console "Authorized redirect URIs"
- No trailing slashes

### "Provider not enabled" error
- Verify "Enable Sign in with Google" is toggled ON in Supabase
- Check Client ID and Secret are saved correctly
- Try saving again in Supabase Dashboard

---

## Security Notes

- **Never commit** Client Secret to git
- Client Secret is only used server-side (Supabase handles this)
- Client ID is safe to expose (it's public)
- Use environment variables for production if managing secrets manually

