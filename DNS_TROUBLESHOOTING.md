# DNS Troubleshooting - Site Not Loading

## Problem

The site `https://margingap.com` is showing a GoDaddy placeholder page instead of your Vercel deployment.

## Root Cause

The domain DNS is pointing to GoDaddy's servers instead of Vercel's servers.

## Solution

### Step 1: Configure Domain in Vercel

1. Go to **Vercel Dashboard**: https://vercel.com/skyler-kellys-projects/margingap
2. Navigate to **Settings** → **Domains**
3. Add your domain: `margingap.com`
4. Vercel will show you the DNS records you need to configure

### Step 2: Update DNS Records in GoDaddy

1. Log in to **GoDaddy** (or your domain registrar)
2. Go to **DNS Management** for `margingap.com`
3. You need to configure one of these options:

#### Option A: Use CNAME (Recommended for subdomains)

If you want `www.margingap.com` to work:
- **Type**: CNAME
- **Name**: `www`
- **Value**: `cname.vercel-dns.com` (or the value Vercel provides)
- **TTL**: 3600 (or default)

#### Option B: Use A Record (For root domain)

For `margingap.com` (root domain):
- **Type**: A
- **Name**: `@` (or blank)
- **Value**: `76.76.21.21` (Vercel's IP - check Vercel dashboard for current IP)
- **TTL**: 3600

**OR** use Vercel's nameservers (recommended):

1. In Vercel Dashboard → Domains → `margingap.com` → **Nameservers**
2. Copy the nameservers Vercel provides (e.g., `ns1.vercel-dns.com`, `ns2.vercel-dns.com`)
3. In GoDaddy → DNS Management → **Change Nameservers**
4. Replace GoDaddy's nameservers with Vercel's nameservers
5. Save and wait for propagation (can take up to 48 hours, usually 1-2 hours)

### Step 3: Remove GoDaddy Placeholder

If you have a GoDaddy website builder active:
1. Go to GoDaddy → **My Products** → **Websites**
2. Find your website and **pause** or **delete** it
3. This will stop the placeholder from showing

### Step 4: Verify DNS Propagation

After updating DNS, verify it's working:

```bash
# Check if domain points to Vercel
dig margingap.com +short

# Should show Vercel IPs (like 76.76.21.21) or CNAME to vercel-dns.com
```

Or use online tools:
- https://dnschecker.org
- https://www.whatsmydns.net

### Step 5: Wait for Propagation

DNS changes can take:
- **Minimum**: 5-15 minutes
- **Typical**: 1-2 hours
- **Maximum**: 48 hours

## Quick Check Commands

```bash
# Check current DNS records
dig margingap.com ANY

# Check if pointing to Vercel
curl -I https://margingap.com

# Should see "server: Vercel" in headers when working
```

## Current Status

Based on the curl test, `margingap.com` is currently:
- ❌ Pointing to GoDaddy servers
- ❌ Showing GoDaddy placeholder page
- ✅ Domain exists and is registered
- ⏳ Needs DNS configuration update

## After DNS is Fixed

Once DNS propagates:
1. ✅ Site should load from Vercel
2. ✅ You'll see your React app
3. ✅ Vercel will handle SSL automatically
4. ✅ Both `margingap.com` and `www.margingap.com` should work

## Need Help?

If you're stuck:
1. Check Vercel Dashboard → Domains for exact DNS values
2. Contact GoDaddy support if DNS changes aren't working
3. Verify domain is actually added in Vercel Dashboard

## Alternative: Use Vercel's Default Domain

While fixing DNS, you can access your site at:
- `https://margin-gap-9cd1.vercel.app` (or whatever Vercel assigned)

This will work immediately while you fix the custom domain DNS.

