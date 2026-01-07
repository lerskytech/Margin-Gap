-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
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

CREATE INDEX IF NOT EXISTS idx_products_canonical_name ON public.products(canonical_name);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

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

CREATE INDEX IF NOT EXISTS idx_scans_user_id ON public.scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_product_id ON public.scans(product_id);
CREATE INDEX IF NOT EXISTS idx_scans_scanned_at ON public.scans(scanned_at DESC);

-- Price points table (time-series data)
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

CREATE INDEX IF NOT EXISTS idx_price_points_product_id ON public.price_points(product_id);
CREATE INDEX IF NOT EXISTS idx_price_points_date ON public.price_points(date DESC);
CREATE INDEX IF NOT EXISTS idx_price_points_source_region ON public.price_points(source_type, region_key);

-- Watchlist table
CREATE TABLE IF NOT EXISTS public.watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON public.watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_product_id ON public.watchlist(product_id);

-- Saved searches table
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  region_key TEXT,
  condition TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scan_credits_updated_at BEFORE UPDATE ON public.scan_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
