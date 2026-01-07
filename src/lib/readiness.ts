// Readiness detection helpers for config badges

export interface FrontendEnvStatus {
  supabaseConfigured: boolean
}

export interface ProviderBadge {
  provider: string
  status: 'ok' | 'error' | 'not_configured'
  label: string
}

export function detectFrontendEnv(): FrontendEnvStatus {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  
  return {
    supabaseConfigured: !!(supabaseUrl && supabaseKey),
  }
}

export function buildProviderBadges(
  aggregates?: Array<{ source_type: string; sample_size: number }>,
  providerStatuses?: Record<string, { status?: string; error?: string }>
): ProviderBadge[] {
  const badges: ProviderBadge[] = []
  
  // Check eBay Active
  const ebayActive = aggregates?.find(a => a.source_type === 'ebay_active')
  const ebayActiveStatus = providerStatuses?.['ebay'] || providerStatuses?.['ebay_active']
  
  if (ebayActiveStatus?.error || (ebayActiveStatus?.status === 'error' && !ebayActive)) {
    badges.push({
      provider: 'ebay_active',
      status: 'not_configured',
      label: 'eBay Active: Not Configured',
    })
  } else if (ebayActiveStatus?.status === 'error' || (ebayActive && ebayActive.sample_size === 0)) {
    badges.push({
      provider: 'ebay_active',
      status: 'error',
      label: 'eBay Active: Error',
    })
  } else if (ebayActive && ebayActive.sample_size > 0) {
    badges.push({
      provider: 'ebay_active',
      status: 'ok',
      label: 'eBay Active: OK',
    })
  }
  
  // Check eBay Sold
  const ebaySold = aggregates?.find(a => a.source_type === 'ebay_sold')
  const ebaySoldStatus = providerStatuses?.['ebay'] || providerStatuses?.['ebay_sold']
  
  if (ebaySoldStatus?.error || (ebaySoldStatus?.status === 'error' && !ebaySold)) {
    badges.push({
      provider: 'ebay_sold',
      status: 'not_configured',
      label: 'eBay Sold: Not Configured',
    })
  } else if (ebaySoldStatus?.status === 'error' || (ebaySold && ebaySold.sample_size === 0)) {
    badges.push({
      provider: 'ebay_sold',
      status: 'error',
      label: 'eBay Sold: Error',
    })
  } else if (ebaySold && ebaySold.sample_size > 0) {
    badges.push({
      provider: 'ebay_sold',
      status: 'ok',
      label: 'eBay Sold: OK',
    })
  }
  
  return badges
}

export function detectEdgeReachability(
  providerStatuses?: Record<string, { status?: string; error?: string }>
): 'ok' | 'unreachable' | 'unknown' {
  // If we have provider statuses, check if any eBay calls succeeded
  if (providerStatuses) {
    const ebayStatus = providerStatuses['ebay'] || providerStatuses['ebay_active'] || providerStatuses['ebay_sold']
    if (ebayStatus?.status === 'success' || ebayStatus?.status === 'partial') {
      return 'ok'
    }
    // If we have an error that suggests unreachability (not just API errors)
    if (ebayStatus?.error?.includes('Supabase') || ebayStatus?.error?.includes('URL')) {
      return 'unreachable'
    }
  }
  
  // Check if Supabase is configured (prerequisite for Edge Functions)
  const { supabaseConfigured } = detectFrontendEnv()
  if (!supabaseConfigured) {
    return 'unreachable'
  }
  
  return 'unknown'
}

