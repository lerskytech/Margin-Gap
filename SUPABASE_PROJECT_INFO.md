# Supabase Project Information

## Project Details

- **Project Name**: margin gap
- **Project ID**: `mjjxvmumjfvlpfnkwzko`
- **Project URL**: `https://mjjxvmumjfvlpfnkwzko.supabase.co`

## Quick Reference URLs

### API Endpoints
- **Project URL**: `https://mjjxvmumjfvlpfnkwzko.supabase.co`
- **Auth Callback**: `https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback`
- **Edge Functions Base**: `https://mjjxvmumjfvlpfnkwzko.supabase.co/functions/v1/`

### Edge Functions
- **scan-product**: `https://mjjxvmumjfvlpfnkwzko.supabase.co/functions/v1/scan-product`
- **ebay-search**: `https://mjjxvmumjfvlpfnkwzko.supabase.co/functions/v1/ebay-search`
- **ebay-sold**: `https://mjjxvmumjfvlpfnkwzko.supabase.co/functions/v1/ebay-sold`
- **evaluate-alerts**: `https://mjjxvmumjfvlpfnkwzko.supabase.co/functions/v1/evaluate-alerts`
- **send-email**: `https://mjjxvmumjfvlpfnkwzko.supabase.co/functions/v1/send-email`

## Environment Variables

### Frontend (`.env`)
```env
VITE_SUPABASE_URL=https://mjjxvmumjfvlpfnkwzko.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### CLI Commands
```bash
# Link project
supabase link --project-ref mjjxvmumjfvlpfnkwzko

# Deploy functions
supabase functions deploy scan-product
supabase functions deploy ebay-search
supabase functions deploy ebay-sold
```

## Google OAuth Configuration

### Required Redirect URI
```
https://mjjxvmumjfvlpfnkwzko.supabase.co/auth/v1/callback
```

This must be added to:
1. **Google Cloud Console** → OAuth 2.0 Client → Authorized redirect URIs
2. **Supabase Dashboard** → Authentication → URL Configuration → Additional Redirect URLs

## Dashboard Access

- **Supabase Dashboard**: https://supabase.com/dashboard/project/mjjxvmumjfvlpfnkwzko
- **Project Settings**: https://supabase.com/dashboard/project/mjjxvmumjfvlpfnkwzko/settings/general
- **API Settings**: https://supabase.com/dashboard/project/mjjxvmumjfvlpfnkwzko/settings/api
- **Edge Functions**: https://supabase.com/dashboard/project/mjjxvmumjfvlpfnkwzko/functions

## Notes

- All documentation has been updated with this project ID
- Project reference is used in all API calls and OAuth redirects
- Keep this information secure (though project ID is public by design)

