// Presence utilities: formatters and helpers for premium UI feel

export function formatMoney(value: number, currency: string = 'USD'): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPct(value: number | undefined, decimals: number = 1): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n < 1000) return n.toString()
  if (n < 1000000) return `${(n / 1000).toFixed(1)}K`
  return `${(n / 1000000).toFixed(1)}M`
}

export interface DeltaInfo {
  pct: number
  direction: 'up' | 'down' | 'neutral'
  label: string
}

export function getDeltaLabel(current: number, reference: number): DeltaInfo {
  if (!Number.isFinite(current) || !Number.isFinite(reference) || reference === 0) {
    return { pct: 0, direction: 'neutral', label: '—' }
  }
  const pct = ((current - reference) / reference) * 100
  const direction = pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral'
  const label = formatPct(pct)
  return { pct, direction, label }
}

export function badgeIntent(
  status: 'undervalued' | 'at_market' | 'overpriced' | string
): 'success' | 'warning' | 'secondary' | 'danger' {
  switch (status) {
    case 'undervalued':
      return 'success'
    case 'overpriced':
      return 'danger'
    case 'at_market':
      return 'secondary'
    default:
      return 'secondary'
  }
}

export function getStatusRationale(
  status: 'undervalued' | 'at_market' | 'overpriced',
  deltaPercent?: number
): string {
  if (status === 'at_market') {
    const absDelta = Math.abs(deltaPercent || 0)
    if (absDelta < 5) {
      return 'within 5% of fair value'
    } else if (absDelta < 10) {
      return 'within 10% of fair value'
    } else {
      return 'near fair value range'
    }
  } else if (status === 'undervalued') {
    return 'below fair value range'
  } else if (status === 'overpriced') {
    return 'above fair value range'
  }
  return 'market analysis pending'
}

