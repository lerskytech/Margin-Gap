// Core domain types

export type Condition = 'new' | 'used' | 'refurbished' | 'open_box'

export type RegionKey = string // e.g., "US", "US:FL:Miami", "US:zip:33139"

export type SourceType = 
  | 'amazon_new'
  | 'ebay'
  | 'ebay_active'
  | 'ebay_sold'
  | 'facebook_marketplace'
  | 'offerup'
  | 'mercari'
  | 'category_benchmark'

export interface Product {
  id: string
  name: string
  description?: string
  category?: string
  brand?: string
  model?: string
  msrp?: number
  canonical_name: string
  created_at: string
  updated_at: string
}

export interface Listing {
  id: string
  product_id: string
  source_type: SourceType
  source_id: string
  title: string
  price: number
  condition: Condition
  url?: string
  image_url?: string
  region_key?: RegionKey
  shipping_available: boolean
  pickup_available: boolean
  seller_rating?: number
  listing_date: string
  scraped_at: string
}

export interface PriceAggregate {
  product_id: string
  source_type: SourceType
  region_key: RegionKey
  condition: Condition
  avg_price: number
  min_price: number
  max_price: number
  median_price: number
  sample_size: number
  date: string
}

export interface PriceTimeSeriesPoint {
  date: string
  avg_price: number
  sample_size: number
  source_type: SourceType
  region_key: RegionKey
  condition?: Condition
}

export interface ProviderResponse {
  listings: Listing[]
  aggregates: PriceAggregate[]
  metadata: {
    provider: SourceType
    query: string
    region_key?: RegionKey
    scanned_at: string
    total_listings: number
    error?: string
    requestId?: string
    providerStatus?: 'success' | 'partial' | 'error'
  }
}

export interface ScanResult {
  scan_id: string
  product_id: string
  query: string
  region_key: RegionKey
  aggregates: PriceAggregate[]
  verdict: Verdict
  scanned_at: string
  listings?: Listing[] // Optional: include listings if available
}

export interface Verdict {
  status: 'undervalued' | 'at_market' | 'overpriced'
  confidence_score: number // 0-1
  fair_value_range: {
    low: number
    high: number
  }
  current_price?: number
  delta_percent?: number
  margin_estimate?: number
}

export interface ScanCredits {
  user_id: string
  credits_remaining: number
  plan_tier: 'free' | 'basic' | 'pro' | 'expert'
  reset_date: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  display_name?: string
  phone?: string
  avatar_url?: string
  email_opt_in: boolean
  sms_opt_in: boolean
  created_at: string
  updated_at: string
}

export interface WatchlistFolder {
  id: string
  user_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface WatchlistItem {
  id: string
  user_id: string
  folder_id?: string
  product_key: string
  title: string
  image_url?: string
  region_key: string
  last_price?: number
  last_change_pct?: number
  created_at: string
  folder?: WatchlistFolder
  // Legacy fields for backward compatibility
  product_id?: string
  product?: Product
  last_scan_time?: string
  verdict?: Verdict
}

export type AlertRuleType = 'PRICE_BELOW' | 'PRICE_ABOVE' | 'PCT_DROP' | 'PCT_RISE'

export interface AlertRule {
  id: string
  user_id: string
  watchlist_item_id: string
  rule_type: AlertRuleType
  threshold: number
  window_days: number
  enabled: boolean
  cooldown_hours: number
  last_triggered_at?: string
  created_at: string
  watchlist_item?: WatchlistItem
}

export interface AlertEvent {
  id: string
  user_id: string
  rule_id: string
  triggered_at: string
  payload: {
    price?: number
    change_pct?: number
    threshold?: number
    rule_type?: string
    source?: string
    [key: string]: any
  }
  rule?: AlertRule
}

export interface SavedSearch {
  id: string
  user_id: string
  query: string
  region_key?: RegionKey
  condition?: Condition
  created_at: string
}

export type Timeframe = '7d' | '30d' | '90d' | '180d' | '1y'

export interface ChartSeries {
  name: string
  data: PriceTimeSeriesPoint[]
  color: string
  visible: boolean
}

export interface ProductIntelligence {
  product: Product
  current_aggregates: PriceAggregate[]
  time_series: PriceTimeSeriesPoint[]
  verdict: Verdict
  metrics: {
    msrp?: number
    fair_value_range: { low: number; high: number }
    local_avg?: number
    national_avg?: number
    shippable_avg?: number
    new_avg?: number
    delta_percent?: number
    margin_estimate?: number
  }
}
