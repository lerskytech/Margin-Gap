// Generated database types placeholder
// In production, generate these from Supabase CLI: supabase gen types typescript

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      scan_credits: {
        Row: {
          user_id: string
          credits_remaining: number
          plan_tier: 'free' | 'basic' | 'pro' | 'expert'
          reset_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          credits_remaining: number
          plan_tier: 'free' | 'basic' | 'pro' | 'expert'
          reset_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          credits_remaining?: number
          plan_tier?: 'free' | 'basic' | 'pro' | 'expert'
          reset_date?: string
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string | null
          brand: string | null
          model: string | null
          msrp: number | null
          canonical_name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category?: string | null
          brand?: string | null
          model?: string | null
          msrp?: number | null
          canonical_name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string | null
          brand?: string | null
          model?: string | null
          msrp?: number | null
          canonical_name?: string
          created_at?: string
          updated_at?: string
        }
      }
      scans: {
        Row: {
          id: string
          user_id: string
          product_id: string
          query: string
          region_key: string
          scanned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          query: string
          region_key: string
          scanned_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          query?: string
          region_key?: string
          scanned_at?: string
        }
      }
      price_points: {
        Row: {
          id: string
          product_id: string
          source_type: string
          region_key: string
          date: string
          avg_price: number
          min_price: number
          max_price: number
          median_price: number
          sample_size: number
          condition: string | null
        }
        Insert: {
          id?: string
          product_id: string
          source_type: string
          region_key: string
          date: string
          avg_price: number
          min_price: number
          max_price: number
          median_price: number
          sample_size: number
          condition?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          source_type?: string
          region_key?: string
          date?: string
          avg_price?: number
          min_price?: number
          max_price?: number
          median_price?: number
          sample_size?: number
          condition?: string | null
        }
      }
      watchlist: {
        Row: {
          id: string
          user_id: string
          product_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          created_at?: string
        }
      }
      saved_searches: {
        Row: {
          id: string
          user_id: string
          query: string
          region_key: string | null
          condition: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          query: string
          region_key?: string | null
          condition?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          query?: string
          region_key?: string | null
          condition?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
