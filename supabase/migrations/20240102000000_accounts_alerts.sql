-- Migration: Accounts + Alerts Foundation
-- Adds enhanced profiles, watchlist folders, alert rules, and email delivery foundation

-- Enable pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Update profiles table to include new fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN NOT NULL DEFAULT false;

-- Migrate full_name to display_name if it exists
UPDATE public.profiles
SET display_name = full_name
WHERE display_name IS NULL AND full_name IS NOT NULL;

-- Watchlist folders table
CREATE TABLE IF NOT EXISTS public.watchlist_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watchlist_folders_user_id ON public.watchlist_folders(user_id);

-- Watchlist items table (replaces/enhances existing watchlist table)
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

CREATE INDEX IF NOT EXISTS idx_watchlist_items_user_id ON public.watchlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_folder_id ON public.watchlist_items(folder_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_product_key ON public.watchlist_items(product_key);

-- Alert rules table
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

CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id ON public.alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_watchlist_item_id ON public.alert_rules(watchlist_item_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON public.alert_rules(enabled) WHERE enabled = true;

-- Alert events table (audit trail)
CREATE TABLE IF NOT EXISTS public.alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.alert_rules(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_events_user_id ON public.alert_events(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_rule_id ON public.alert_events(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_triggered_at ON public.alert_events(triggered_at DESC);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for watchlist_folders
DROP POLICY IF EXISTS "Users can manage own folders" ON public.watchlist_folders;
CREATE POLICY "Users can manage own folders" ON public.watchlist_folders
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for watchlist_items
DROP POLICY IF EXISTS "Users can manage own watchlist items" ON public.watchlist_items;
CREATE POLICY "Users can manage own watchlist items" ON public.watchlist_items
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for alert_rules
DROP POLICY IF EXISTS "Users can manage own alert rules" ON public.alert_rules;
CREATE POLICY "Users can manage own alert rules" ON public.alert_rules
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for alert_events
DROP POLICY IF EXISTS "Users can view own alert events" ON public.alert_events;
CREATE POLICY "Users can view own alert events" ON public.alert_events
  FOR SELECT USING (auth.uid() = user_id);

-- Update handle_new_user function to include new profile fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    avatar_url,
    email_opt_in,
    sms_opt_in
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    true,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Initialize scan credits (free tier: 10 credits per month)
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

