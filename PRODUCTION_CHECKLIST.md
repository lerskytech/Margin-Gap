# Production Deployment Checklist

## ✅ Deployment Complete

Your app is deployed at: **https://margingap.com** (custom domain)

Vercel Dashboard: https://vercel.com/skyler-kellys-projects/margingap

---

## 🔧 Required Post-Deployment Steps

### 1. Update Supabase Redirect URLs

Go to: **Supabase Dashboard → Authentication → URL Configuration**

Add to **Additional Redirect URLs:**
```
https://margingap.com/auth/callback
https://margingap.com
```

Update **Site URL** to:
```
https://margingap.com
```

Click **Save**

---

### 2. Update Google OAuth (if using Google sign-in)

Go to: **Google Cloud Console → APIs & Services → Credentials → Your OAuth 2.0 Client ID**

Add to **Authorized JavaScript origins:**
```
https://margingap.com
```

Add to **Authorized redirect URIs:**
```
https://margingap.com/auth/callback
```

Click **Save**

---

### 3. Verify Environment Variables in Vercel

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Verify these are set:
- ✅ `VITE_SUPABASE_URL` = `https://mjjxvmumjfvlpfnkwzko.supabase.co`
- ✅ `VITE_SUPABASE_ANON_KEY` = (your anon key)

If missing, add them and **redeploy**.

---

### 4. Test Production Deployment

Visit: **https://margingap.com**

Test checklist:
- [ ] App loads without errors
- [ ] Login page displays correctly
- [ ] Email/password sign-in works
- [ ] Google OAuth sign-in works (if configured)
- [ ] Dashboard loads after authentication
- [ ] No console errors
- [ ] Favicon displays correctly

---

### 5. Custom Domain (Optional)

If you want a custom domain:

1. Go to **Vercel Dashboard → Your Project → Settings → Domains**
2. Add your domain (e.g., `margin-gap.com`)
3. Follow DNS configuration instructions
4. Update Supabase and Google OAuth with new domain
5. Wait for DNS propagation

---

## 🐛 Troubleshooting

### App shows "Auth disabled" or Supabase errors

- Check environment variables are set in Vercel
- Verify they're added to **all environments** (Production, Preview, Development)
- Redeploy after adding variables

### OAuth redirect errors

- Verify Supabase redirect URLs include production domain
- Check Google OAuth redirect URIs include production domain
- Ensure no trailing slashes in URLs

### 404 errors on routes

- Verify `vercel.json` has SPA rewrite rule (already configured)
- Check build completed successfully
- Clear browser cache

### Build fails

- Check build logs in Vercel Dashboard
- Verify `package.json` has correct scripts
- Ensure all dependencies are listed

---

## 📊 Monitoring

Monitor your deployment:
- **Vercel Dashboard**: https://vercel.com/skyler-kellys-projects/margingap
- **Analytics**: View in Vercel Dashboard → Analytics
- **Logs**: View in Vercel Dashboard → Logs
- **Speed Insights**: View in Vercel Dashboard → Speed Insights

---

## 🔄 Continuous Deployment

Vercel automatically deploys:
- **Production**: Every push to `main` branch
- **Preview**: Every pull request and branch push

No additional configuration needed!

---

## 📝 Next Steps

1. ✅ Update Supabase redirect URLs
2. ✅ Update Google OAuth (if using)
3. ✅ Test all authentication flows
4. ✅ Test core functionality
5. ✅ Monitor for errors
6. ✅ Set up custom domain (optional)

Your app is live! 🚀

