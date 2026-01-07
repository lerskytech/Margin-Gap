# Step-by-Step: Add Redirect URIs to Google Cloud Console

## Where to Add the URLs

You need to add them in **Google Cloud Console** → **OAuth 2.0 Client ID** → **Authorized redirect URIs**

---

## Detailed Steps

### Step 1: Go to Google Cloud Console

1. Open your browser
2. Go to: **https://console.cloud.google.com/**
3. Sign in with your Google account (the one that created the OAuth credentials)

### Step 2: Select Your Project

1. At the top of the page, click the **project dropdown** (shows current project name)
2. Select the project that contains your MarginGap OAuth credentials
   - If you're not sure which project, look for one with "MarginGap" or "Price Intel" in the name

### Step 3: Navigate to Credentials

1. In the left sidebar, click **"APIs & Services"**
2. Click **"Credentials"** (or it might be under "APIs & Services" → "Credentials")

### Step 4: Find Your OAuth 2.0 Client ID

1. Scroll down to the **"OAuth 2.0 Client IDs"** section
2. You'll see a list of OAuth clients
3. Find the one for MarginGap (might be named "Price Intel Scanner OAuth" or similar)
4. Click the **pencil icon** (✏️) or **"Edit"** button on the right side

### Step 5: Add Redirect URIs

1. Scroll down to the **"Authorized redirect URIs"** section
2. You'll see a list of existing URIs (might be empty or have some URLs)
3. Click the **"+ ADD URI"** button (or just click in the text field)
4. Add each URL one at a time:

**Copy and paste these URLs (one per line):**

```
https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback
https://margingap.com/auth/callback
https://www.margingap.com/auth/callback
http://localhost:5179/auth/callback
http://localhost:5173/auth/callback
```

**Important:**
- Add them one at a time
- Make sure there are **no trailing slashes** (no `/` at the end)
- Make sure `https://` is included (not `http://` for production URLs)
- The Supabase one (`https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback`) is **REQUIRED**

### Step 6: Save

1. Scroll to the bottom of the page
2. Click the **"SAVE"** button (usually blue, at the bottom right)
3. Wait for the "Saved" confirmation message

### Step 7: Wait 1-2 Minutes

Google needs a minute or two to propagate the changes. Don't test immediately.

---

## Visual Guide

Here's what the page should look like:

```
┌─────────────────────────────────────────┐
│  OAuth client                          │
│                                         │
│  Name: Price Intel Scanner OAuth       │
│                                         │
│  Authorized JavaScript origins:         │
│  ┌─────────────────────────────────┐   │
│  │ http://localhost:5179           │   │
│  │ http://localhost:5173            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Authorized redirect URIs:             │
│  ┌─────────────────────────────────┐   │
│  │ https://mjjxvmumjfvlpfnkwzko... │   │ ← ADD THIS FIRST
│  │ https://margingap.com/auth/...  │   │ ← Then this
│  │ https://www.margingap.com/...   │   │ ← Then this
│  │ http://localhost:5179/auth/...  │   │ ← Then this
│  │ http://localhost:5173/auth/...  │   │ ← Then this
│  └─────────────────────────────────┘   │
│                                         │
│  [SAVE] button                         │
└─────────────────────────────────────────┘
```

---

## Quick Checklist

- [ ] Opened Google Cloud Console
- [ ] Selected correct project
- [ ] Went to APIs & Services → Credentials
- [ ] Found OAuth 2.0 Client ID
- [ ] Clicked Edit (pencil icon)
- [ ] Added `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback`
- [ ] Added `https://margingap.com/auth/callback`
- [ ] Added `https://www.margingap.com/auth/callback`
- [ ] Added `http://localhost:5179/auth/callback`
- [ ] Added `http://localhost:5173/auth/callback`
- [ ] Clicked SAVE
- [ ] Waited 1-2 minutes

---

## If You Can't Find It

### Can't find the OAuth client?

1. Make sure you're in the correct Google Cloud project
2. Check if you created it under a different account
3. You might need to create a new OAuth 2.0 Client ID:
   - Click **"+ CREATE CREDENTIALS"** at the top
   - Select **"OAuth client ID"**
   - Choose **"Web application"**
   - Fill in the name and redirect URIs

### Can't see "APIs & Services"?

1. Make sure you have the correct permissions
2. Try using the search bar at the top: type "credentials"
3. Or go directly to: `https://console.cloud.google.com/apis/credentials`

---

## After Adding URLs

1. **Wait 1-2 minutes** for changes to propagate
2. **Try signing in with Google** again
3. The error should be gone!

---

## Need Help?

If you're still stuck:
1. Take a screenshot of the page you're on
2. Check which step you're at
3. Make sure you're in the right Google Cloud project

The most important URL is:
**`https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback`**

Add that one first, save, and test!

