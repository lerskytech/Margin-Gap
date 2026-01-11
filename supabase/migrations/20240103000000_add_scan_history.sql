-- Migration: Add scan_history table for real time-series trend data
-- This table stores one row per successful scan for building trend charts

CREATE TABLE IF NOT EXISTS public.scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  scan_key TEXT NOT NULL,
  query TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('national', 'local')),
  location_key TEXT,
  sources TEXT[] NOT NULL DEFAULT '{}',
  msrp NUMERIC(10, 2),
  national_used_avg NUMERIC(10, 2),
  local_avg NUMERIC(10, 2),
  shippable_avg NUMERIC(10, 2),
  ebay_used_avg NUMERIC(10, 2),
  sample_size INTEGER,
  source_count INTEGER,
  confidence INTEGER
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_scan_history_scan_key_created_at ON public.scan_history(scan_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_history_user_id_created_at ON public.scan_history(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scan_history_query_created_at ON public.scan_history(query, created_at DESC);

-- RLS policies
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own scan history
DROP POLICY IF EXISTS "Users can view own scan history" ON public.scan_history;
CREATE POLICY "Users can view own scan history"
  ON public.scan_history FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Service role can insert (for Edge Functions)
-- Note: Edge Functions use service role, so they can insert without user_id restrictions
