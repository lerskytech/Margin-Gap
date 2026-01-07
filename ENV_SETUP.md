# Environment Variables Setup

Quick guide to configure frontend environment variables for MarginGap.

## Step 1: Get Supabase Credentials

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Project Settings** → **API**
4. Copy:
   - **Project URL** (e.g., `https://abcdefghijklmnop.supabase.co`)
   - **anon public** key (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

## Step 2: Create .env File

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` in your editor

3. Paste your values:
   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. Replace:
   - `YOUR_PROJECT_REF` with your actual project reference ID
   - The anon key with your actual anon public key

## Step 3: Verify Setup

1. **Restart your dev server:**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Check console:**
   - Should NOT see: "Missing Supabase environment variables"
   - Should see app loading normally

3. **Test auth:**
   - Go to `/login`
   - "Continue with Google" button should be enabled
   - No "Auth is disabled" message

## Important Notes

- **Never commit `.env` to git** (already in `.gitignore`)
- **Never share your anon key publicly** (though it's safe in frontend code)
- **Service role key stays server-only** (never in frontend)
- The anon key is safe to expose in frontend code (it's public by design)

## Production Setup

For production (Vercel, Netlify, etc.):

1. Go to your hosting platform's environment variables settings
2. Add the same two variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Redeploy your app

## Troubleshooting

**"Auth is disabled" still shows:**
- Verify `.env` file exists in project root
- Check variable names are exactly: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart dev server after creating/editing `.env`
- Check for typos in URLs (must be HTTPS)

**Build fails:**
- Ensure `.env` values don't have quotes around them
- No trailing spaces
- Use actual values, not placeholders

