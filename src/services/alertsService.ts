// Service for managing product alerts via Edge Functions
import { supabase, supabaseEnabled } from './supabase'

export interface ProductAlert {
  id: string
  user_id: string
  query_text: string
  scope: 'national' | 'local'
  region: string | null
  condition: {
    type: 'gap_above' | 'price_below' | 'price_above' | 'pct_below_msrp' | 'pct_above_msrp'
    value: number
  }
  is_active: boolean
  last_triggered_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateAlertRequest {
  query_text: string
  scope?: 'national' | 'local'
  region?: string
  condition: {
    type: 'gap_above' | 'price_below' | 'price_above' | 'pct_below_msrp' | 'pct_above_msrp'
    value: number
  }
}

export const alertsService = {
  async createAlert(request: CreateAlertRequest): Promise<ProductAlert> {
    if (!supabaseEnabled || !supabase) {
      throw new Error('Supabase is not configured')
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await supabase.functions.invoke('create-alert', {
      body: request
    })

    if (response.error) {
      throw new Error(response.error.message || 'Failed to create alert')
    }

    if (!response.data?.alert) {
      throw new Error('Invalid response from server')
    }

    return response.data.alert as ProductAlert
  },

  async listAlerts(activeOnly = false): Promise<ProductAlert[]> {
    if (!supabaseEnabled || !supabase) {
      throw new Error('Supabase is not configured')
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await supabase.functions.invoke('list-alerts', {
      body: { active_only: activeOnly }
    })

    if (response.error) {
      throw new Error(response.error.message || 'Failed to list alerts')
    }

    return (response.data?.alerts || []) as ProductAlert[]
  },

  async deleteAlert(alertId: string): Promise<void> {
    if (!supabaseEnabled || !supabase) {
      throw new Error('Supabase is not configured')
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await supabase.functions.invoke('delete-alert', {
      body: { id: alertId }
    })

    if (response.error) {
      throw new Error(response.error.message || 'Failed to delete alert')
    }
  },

  async toggleAlert(alertId: string, isActive: boolean): Promise<void> {
    if (!supabaseEnabled || !supabase) {
      throw new Error('Supabase is not configured')
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    // Update via direct table access (RLS will enforce ownership)
    const { error } = await supabase
      .from('product_alerts')
      .update({ is_active: isActive })
      .eq('id', alertId)

    if (error) {
      throw new Error(error.message || 'Failed to update alert')
    }
  }
}

