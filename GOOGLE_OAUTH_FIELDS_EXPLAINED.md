# Google OAuth: Two Different Fields Explained

## The Error You're Seeing

```
Invalid Origin: URIs must not contain a path or end with "/".
```

This happens when you try to add a URL with a path (like `/auth/v1/callback`) to the **"Authorized JavaScript origins"** field.

---

## Two Different Fields

Google Cloud Console has **TWO separate fields** for OAuth configuration:

### 1. Authorized JavaScript origins
- **Purpose**: Where your app is hosted (the domain)
- **Format**: Just the domain, **NO paths**
- **Example**: `https://margingap.com`
- **Cannot have**: `/auth/callback` or any path

### 2. Authorized redirect URIs
- **Purpose**: Where Google redirects after authentication
- **Format**: Full URL **WITH paths allowed**
- **Example**: `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback`
- **Can have**: Any path like `/auth/callback`, `/auth/v1/callback`, etc.

---

## What Goes Where

### Authorized JavaScript origins (No paths!)
Add these domains (no `/` at the end, no paths):

```
https://margingap.com
https://www.margingap.com
http://localhost:5179
http://localhost:5173
```

### Authorized redirect URIs (Paths allowed!)
Add these full URLs (with paths):

```
https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback
https://margingap.com/auth/callback
https://www.margingap.com/auth/callback
http://localhost:5179/auth/callback
http://localhost:5173/auth/callback
```

---

## Visual Guide

```
┌─────────────────────────────────────────┐
│  OAuth client                          │
│                                         │
│  Authorized JavaScript origins:        │
│  ┌─────────────────────────────────┐   │
│  │ https://margingap.com           │   │ ← Domain only
│  │ https://www.margingap.com        │   │ ← Domain only
│  │ http://localhost:5179            │   │ ← Domain only
│  │ http://localhost:5173            │   │ ← Domain only
│  └─────────────────────────────────┘   │
│                                         │
│  Authorized redirect URIs:              │
│  ┌─────────────────────────────────┐   │
│  │ https://mjjxvmumjfvlpfnkwzko... │   │ ← Full URL with path
│  │    ...supabase.co/auth/v1/...   │   │
│  │ https://margingap.com/auth/...  │   │ ← Full URL with path
│  │ https://www.margingap.com/...   │   │ ← Full URL with path
│  │ http://localhost:5179/auth/...  │   │ ← Full URL with path
│  │ http://localhost:5173/auth/...  │   │ ← Full URL with path
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## Step-by-Step Fix

### Step 1: Authorized JavaScript origins
1. Find the **"Authorized JavaScript origins"** section
2. Add these (one per line, no paths):
   ```
   https://margingap.com
   https://www.margingap.com
   http://localhost:5179
   http://localhost:5173
   ```

### Step 2: Authorized redirect URIs
1. Scroll down to **"Authorized redirect URIs"** section
2. Add these (one per line, with full paths):
   ```
   https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback
   https://margingap.com/auth/callback
   https://www.margingap.com/auth/callback
   http://localhost:5179/auth/callback
   http://localhost:5173/auth/callback
   ```

### Step 3: Save
Click **SAVE** at the bottom

---

## Quick Reference

| Field | What It's For | Format | Example |
|-------|---------------|--------|---------|
| **JavaScript origins** | Where your app runs | Domain only (no path) | `https://margingap.com` |
| **Redirect URIs** | Where Google redirects | Full URL (with path) | `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback` |

---

## The Critical One

The **most important** redirect URI is:
```
https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback
```

This **MUST** go in **"Authorized redirect URIs"** (the field that allows paths), NOT in "Authorized JavaScript origins".

---

## Summary

- ❌ **Wrong**: Adding `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback` to "Authorized JavaScript origins"
- ✅ **Right**: Adding `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback` to "Authorized redirect URIs"

The Supabase callback URL has a path (`/auth/v1/callback`), so it can **only** go in the redirect URIs field!

