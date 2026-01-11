-- Migration: Add scan_trend_points table for scan-history based trends
-- This table stores one point per successful scan for building trend charts

CREATE TABLE IF NOT EXISTS public.scan_trend_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  query TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'US',
  location_type TEXT NOT NULL DEFAULT 'none' CHECK (location_type IN ('none', 'zip', 'city')),
  location_value TEXT,
  series JSONB NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_scan_trend_points_query_scope_location ON public.scan_trend_points(query, scope, location_type, location_value);
CREATE INDEX IF NOT EXISTS idx_scan_trend_points_created_at ON public.scan_trend_points(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_trend_points_user_id ON public.scan_trend_points(user_id) WHERE user_id IS NOT NULL;

-- RLS policies
ALTER TABLE public.scan_trend_points ENABLE ROW LEVEL SECURITY;

-- Users can view their own trend points
DROP POLICY IF EXISTS "Users can view own trend points" ON public.scan_trend_points;
CREATE POLICY "Users can view own trend points"
  ON public.scan_trend_points FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can insert their own trend points
DROP POLICY IF EXISTS "Users can insert own trend points" ON public.scan_trend_points;
CREATE POLICY "Users can insert own trend points"
  ON public.scan_trend_points FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow service role to insert (for Edge Functions)
-- Note: Edge Functions use service role, so they can insert without user_id
