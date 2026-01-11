-- Migration: Add scan_key and location fields to price_points table
-- This enables proper time-series tracking by scan_key (query + scope + sources + location)

-- Add query column if it doesn't exist (for backward compatibility)
ALTER TABLE public.price_points
  ADD COLUMN IF NOT EXISTS query TEXT;

-- Add new columns to price_points table
ALTER TABLE public.price_points
  ADD COLUMN IF NOT EXISTS scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scan_key TEXT,
  ADD COLUMN IF NOT EXISTS scope TEXT,
  ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'national' CHECK (location_type IN ('national', 'zip', 'city')),
  ADD COLUMN IF NOT EXISTS location_value TEXT,
  ADD COLUMN IF NOT EXISTS msrp NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS national_used_avg NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS shippable_avg NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS local_avg NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS source_count INTEGER,
  ADD COLUMN IF NOT EXISTS confidence INTEGER;

-- Update scan_key to NOT NULL after adding data (set default for existing rows)
UPDATE public.price_points
SET scan_key = COALESCE(scan_key, query || '|' || COALESCE(region_key, 'US') || '|unknown|national:national')
WHERE scan_key IS NULL OR scan_key = '';

ALTER TABLE public.price_points
  ALTER COLUMN scan_key SET NOT NULL,
  ALTER COLUMN scan_key SET DEFAULT '';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_price_points_scan_key_created_at ON public.price_points(scan_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_points_query_created_at ON public.price_points(query, created_at DESC) WHERE query IS NOT NULL;

-- Update RLS policies to allow reads for authenticated users
-- (Insert should only happen via Edge Functions)
DROP POLICY IF EXISTS "Authenticated users can view price points" ON public.price_points;
CREATE POLICY "Authenticated users can view price points"
  ON public.price_points FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Keep insert policy restricted (only Edge Functions with service role)
DROP POLICY IF EXISTS "Authenticated users can insert price points" ON public.price_points;
-- No insert policy - only service role can insert via Edge Functions
