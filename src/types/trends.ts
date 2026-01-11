// Trend data types for real-time price trends from providers

export type TrendPoint = {
  ts: string; // ISO timestamp string
  value: number; // Price value
  sampleSize?: number; // Number of listings/samples for this point
}

export type TrendSeries = {
  provider: 'ebay';
  metric: 'sold_median' | 'active_median';
  currency: string;
  points: TrendPoint[];
  meta: {
    query: string;
    scope: string;
    location?: string;
    sourceCount?: number;
    note?: string;
  };
}

export type TrendResponse =
  | { ok: true; series: TrendSeries }
  | { ok: false; code: string; message: string }

export type TrendRequest = {
  query: string;
  timeframe: '7d' | '30d' | '90d' | '180d' | '1y' | '2y' | '5y' | 'all';
  scope: 'US' | 'National';
  location?: {
    type: 'zip' | 'city' | 'none';
    value?: string;
  };
  metric?: 'sold_median' | 'active_median';
}
