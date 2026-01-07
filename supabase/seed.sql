-- Seed script (optional - run manually for testing)
-- This creates sample products with mock price history

-- Insert sample products (only if they don't exist)
INSERT INTO public.products (id, name, description, category, brand, model, msrp, canonical_name)
VALUES
  (
    '550e8400-e29b-41d4-a716-446655440000',
    'iPhone 13 Pro',
    'Apple iPhone 13 Pro 128GB',
    'Electronics',
    'Apple',
    'iPhone 13 Pro',
    999.00,
    'iphone-13-pro-128gb'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440001',
    'Nike Air Jordan 1 Retro High',
    'Nike Air Jordan 1 Retro High OG "Chicago"',
    'Footwear',
    'Nike',
    'Air Jordan 1',
    170.00,
    'nike-air-jordan-1-retro-high-chicago'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440002',
    'Charizard VMAX Pokemon Card',
    'Pokemon TCG Charizard VMAX 020/189',
    'Trading Cards',
    'Pokemon',
    'Charizard VMAX',
    200.00,
    'charizard-vmax-pokemon-card'
  )
ON CONFLICT (id) DO NOTHING;

-- Note: Price points would be populated by actual scans
-- This is just a reference for the schema
