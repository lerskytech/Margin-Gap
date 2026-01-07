-- ============================================
-- MARGINGAP - COMPLETE DATABASE SCHEMA
-- ============================================
-- Paste this ENTIRE file in Supabase Dashboard SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABLES
-- ============================================

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  email_opt_in BOOLEAN NOT NULL DEFAULT true,
  sms_opt_in BOOLEAN NOT NULL DEFAULT false,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro', 'expert')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  brand TEXT,
  model TEXT,
  msrp NUMERIC(10, 2),
  canonical_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scan credits table
CREATE TABLE IF NOT EXISTS public.scan_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'basic', 'pro', 'expert')),
  reset_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scans table
CREATE TABLE IF NOT EXISTS public.scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  region_key TEXT NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Price points table
CREATE TABLE IF NOT EXISTS public.price_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  region_key TEXT NOT NULL,
  date DATE NOT NULL,
  avg_price NUMERIC(10, 2) NOT NULL,
  min_price NUMERIC(10, 2) NOT NULL,
  max_price NUMERIC(10, 2) NOT NULL,
  median_price NUMERIC(10, 2) NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  condition TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, source_type, region_key, date, condition)
);

-- Watchlist table (legacy)
CREATE TABLE IF NOT EXISTS public.watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Watchlist folders table
CREATE TABLE IF NOT EXISTS public.watchlist_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Watchlist items table
CREATE TABLE IF NOT EXISTS public.watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.watchlist_folders(id) ON DELETE SET NULL,
  product_key TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  region_key TEXT NOT NULL DEFAULT 'US',
  last_price NUMERIC(10, 2),
  last_change_pct NUMERIC(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_key, region_key)
);

-- Alert rules table (watchlist-based)
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  watchlist_item_id UUID NOT NULL REFERENCES public.watchlist_items(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('PRICE_BELOW', 'PRICE_ABOVE', 'PCT_DROP', 'PCT_RISE')),
  threshold NUMERIC(10, 2) NOT NULL,
  window_days INTEGER NOT NULL DEFAULT 30,
  enabled BOOLEAN NOT NULL DEFAULT true,
  cooldown_hours INTEGER NOT NULL DEFAULT 24,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alert events table
CREATE TABLE IF NOT EXISTS public.alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.alert_rules(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL
);

-- Product alerts table (standalone, query-based)
CREATE TABLE IF NOT EXISTS public.product_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL, -- Email for notifications (copy of auth email at creation time)
  query_text TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'national' CHECK (scope IN ('national', 'local')),
  region TEXT,
  condition JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ, -- When email was last sent (for rate limiting)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Saved searches table
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  region_key TEXT,
  condition TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shared reports table
CREATE TABLE IF NOT EXISTS public.shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_id TEXT,
  query TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_products_canonical_name ON public.products(canonical_name);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON public.scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_product_id ON public.scans(product_id);
CREATE INDEX IF NOT EXISTS idx_scans_scanned_at ON public.scans(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_points_product_id ON public.price_points(product_id);
CREATE INDEX IF NOT EXISTS idx_price_points_date ON public.price_points(date DESC);
CREATE INDEX IF NOT EXISTS idx_price_points_source_region ON public.price_points(source_type, region_key);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON public.watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_product_id ON public.watchlist(product_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_folders_user_id ON public.watchlist_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_user_id ON public.watchlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_folder_id ON public.watchlist_items(folder_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_product_key ON public.watchlist_items(product_key);
CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id ON public.alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_watchlist_item_id ON public.alert_rules(watchlist_item_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON public.alert_rules(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_alert_events_user_id ON public.alert_events(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_rule_id ON public.alert_events(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_triggered_at ON public.alert_events(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_alerts_user_id ON public.product_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_product_alerts_is_active ON public.product_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_product_alerts_created_at ON public.product_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_reports_user_id ON public.shared_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_reports_token ON public.shared_reports(token);

-- ============================================
-- FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    display_name,
    avatar_url,
    email_opt_in,
    sms_opt_in,
    plan
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    true,
    false,
    'free'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  
  INSERT INTO public.scan_credits (user_id, credits_remaining, plan_tier, reset_date)
  VALUES (
    NEW.id,
    10,
    'free',
    (CURRENT_DATE + INTERVAL '1 month')::DATE
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE public.profiles
    SET email = NEW.email
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scan_credits_updated_at ON public.scan_credits;
CREATE TRIGGER update_scan_credits_updated_at
  BEFORE UPDATE ON public.scan_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_alerts_updated_at ON public.product_alerts;
CREATE TRIGGER update_product_alerts_updated_at
  BEFORE UPDATE ON public.product_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS sync_profile_email_trigger ON auth.users;
CREATE TRIGGER sync_profile_email_trigger
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_profile_email();

-- ============================================
-- DATA MIGRATIONS
-- ============================================

-- Add missing columns to profiles (safe if already exist)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro', 'expert'));

-- Migrate full_name to display_name
UPDATE public.profiles
SET display_name = full_name
WHERE display_name IS NULL AND full_name IS NOT NULL;

-- Sync email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email != u.email);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_points ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Scan credits policies
DROP POLICY IF EXISTS "Users can view their own credits" ON public.scan_credits;
CREATE POLICY "Users can view their own credits"
  ON public.scan_credits FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own credits" ON public.scan_credits;
CREATE POLICY "Users can update their own credits"
  ON public.scan_credits FOR UPDATE
  USING (auth.uid() = user_id);

-- Scans policies
DROP POLICY IF EXISTS "Users can view their own scans" ON public.scans;
CREATE POLICY "Users can view their own scans"
  ON public.scans FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own scans" ON public.scans;
CREATE POLICY "Users can insert their own scans"
  ON public.scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Watchlist policies
DROP POLICY IF EXISTS "Users can view their own watchlist" ON public.watchlist;
CREATE POLICY "Users can view their own watchlist"
  ON public.watchlist FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert into their own watchlist" ON public.watchlist;
CREATE POLICY "Users can insert into their own watchlist"
  ON public.watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete from their own watchlist" ON public.watchlist;
CREATE POLICY "Users can delete from their own watchlist"
  ON public.watchlist FOR DELETE
  USING (auth.uid() = user_id);

-- Watchlist folders policies
DROP POLICY IF EXISTS "Users can manage own folders" ON public.watchlist_folders;
CREATE POLICY "Users can manage own folders"
  ON public.watchlist_folders
  FOR ALL USING (auth.uid() = user_id);

-- Watchlist items policies
DROP POLICY IF EXISTS "Users can manage own watchlist items" ON public.watchlist_items;
CREATE POLICY "Users can manage own watchlist items"
  ON public.watchlist_items
  FOR ALL USING (auth.uid() = user_id);

-- Alert rules policies
DROP POLICY IF EXISTS "Users can manage own alert rules" ON public.alert_rules;
CREATE POLICY "Users can manage own alert rules"
  ON public.alert_rules
  FOR ALL USING (auth.uid() = user_id);

-- Alert events policies
DROP POLICY IF EXISTS "Users can view own alert events" ON public.alert_events;
CREATE POLICY "Users can view own alert events"
  ON public.alert_events
  FOR SELECT USING (auth.uid() = user_id);

-- Product alerts policies
DROP POLICY IF EXISTS "Users can view own alerts" ON public.product_alerts;
CREATE POLICY "Users can view own alerts"
  ON public.product_alerts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own alerts" ON public.product_alerts;
CREATE POLICY "Users can insert own alerts"
  ON public.product_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own alerts" ON public.product_alerts;
CREATE POLICY "Users can update own alerts"
  ON public.product_alerts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own alerts" ON public.product_alerts;
CREATE POLICY "Users can delete own alerts"
  ON public.product_alerts FOR DELETE
  USING (auth.uid() = user_id);

-- Saved searches policies
DROP POLICY IF EXISTS "Users can view their own saved searches" ON public.saved_searches;
CREATE POLICY "Users can view their own saved searches"
  ON public.saved_searches FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own saved searches" ON public.saved_searches;
CREATE POLICY "Users can insert their own saved searches"
  ON public.saved_searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own saved searches" ON public.saved_searches;
CREATE POLICY "Users can delete their own saved searches"
  ON public.saved_searches FOR DELETE
  USING (auth.uid() = user_id);

-- Shared reports policies (users can only manage their own shares)
DROP POLICY IF EXISTS "Users can manage own shared reports" ON public.shared_reports;
CREATE POLICY "Users can manage own shared reports"
  ON public.shared_reports
  FOR ALL USING (auth.uid() = user_id);

-- Products policies
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
CREATE POLICY "Authenticated users can insert products"
  ON public.products FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Price points policies
DROP POLICY IF EXISTS "Authenticated users can view price points" ON public.price_points;
CREATE POLICY "Authenticated users can view price points"
  ON public.price_points FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert price points" ON public.price_points;
CREATE POLICY "Authenticated users can insert price points"
  ON public.price_points FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

