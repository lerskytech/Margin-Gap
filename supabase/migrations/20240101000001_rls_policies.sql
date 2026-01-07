-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- Products and price_points are public (read-only for all authenticated users)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_points ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Scan credits policies
CREATE POLICY "Users can view their own credits"
  ON public.scan_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own credits"
  ON public.scan_credits FOR UPDATE
  USING (auth.uid() = user_id);

-- Scans policies
CREATE POLICY "Users can view their own scans"
  ON public.scans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scans"
  ON public.scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Watchlist policies
CREATE POLICY "Users can view their own watchlist"
  ON public.watchlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into their own watchlist"
  ON public.watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete from their own watchlist"
  ON public.watchlist FOR DELETE
  USING (auth.uid() = user_id);

-- Saved searches policies
CREATE POLICY "Users can view their own saved searches"
  ON public.saved_searches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved searches"
  ON public.saved_searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved searches"
  ON public.saved_searches FOR DELETE
  USING (auth.uid() = user_id);

-- Products policies (public read for authenticated users)
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert products"
  ON public.products FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Price points policies (public read for authenticated users)
CREATE POLICY "Authenticated users can view price points"
  ON public.price_points FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert price points"
  ON public.price_points FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
