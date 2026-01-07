// Supabase Edge Function: run-alerts
// Scheduled function that evaluates all active alerts and sends emails when triggered
// Should be called via cron (e.g., every 6 hours)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from '../_shared/cors.ts'

const COOLDOWN_HOURS = 6 // Minimum hours between alerts for same alert

interface AlertCondition {
  type: 'gap_above' | 'price_below' | 'price_above' | 'pct_below_msrp' | 'pct_above_msrp'
  value: number
}

interface ScanResult {
  aggregates: Array<{
    source_type: string
    avg_price: number
    median_price: number
    sample_size: number
    region_key?: string
    condition?: string
  }>
  verdict: {
    status: string
    confidence_score: number
    fair_value_range: { low: number; high: number }
  }
  msrp?: number
  query?: string
}

async function evaluateCondition(condition: AlertCondition, scanResult: ScanResult): Promise<boolean> {
  const { type, value } = condition

  // Get relevant price (prefer median, fallback to avg)
  const prices = scanResult.aggregates
    .map(agg => agg.median_price || agg.avg_price)
    .filter(p => p > 0)

  if (prices.length === 0) return false

  const marketPrice = prices.reduce((a, b) => a + b, 0) / prices.length
  const msrp = scanResult.msrp || 0

  switch (type) {
    case 'gap_above':
      // Gap = MSRP - Market Price
      const gap = msrp > 0 ? msrp - marketPrice : 0
      return gap >= value

    case 'price_below':
      return marketPrice <= value

    case 'price_above':
      return marketPrice >= value

    case 'pct_below_msrp':
      if (msrp <= 0) return false
      const pctBelow = ((msrp - marketPrice) / msrp) * 100
      return pctBelow >= value

    case 'pct_above_msrp':
      if (msrp <= 0) return false
      const pctAbove = ((marketPrice - msrp) / msrp) * 100
      return pctAbove >= value

    default:
      return false
  }
}

async function sendAlertEmail(
  supabaseUrl: string,
  to: string,
  alert: any,
  scanResult: ScanResult
): Promise<boolean> {
  const emailFunctionUrl = `${supabaseUrl}/functions/v1/send-email`
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  const prices = scanResult.aggregates
    .map(agg => agg.median_price || agg.avg_price)
    .filter(p => p > 0)
  const marketPrice = prices.length > 0 
    ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    : 0
  const msrp = scanResult.msrp || 0
  const gap = msrp > 0 ? msrp - marketPrice : 0

  const conditionText = {
    gap_above: `Gap above $${alert.condition.value}`,
    price_below: `Price below $${alert.condition.value}`,
    price_above: `Price above $${alert.condition.value}`,
    pct_below_msrp: `${alert.condition.value}% below MSRP`,
    pct_above_msrp: `${alert.condition.value}% above MSRP`
  }[alert.condition.type] || 'Condition met'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .metric-label { font-weight: 600; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 MarginGap Alert Triggered</h1>
        </div>
        <div class="content">
          <p>Your alert for <strong>${alert.query_text}</strong> has been triggered!</p>
          <p><strong>Condition:</strong> ${conditionText}</p>
          <div class="metric">
            <span class="metric-label">Market Price:</span>
            <span>$${marketPrice.toLocaleString()}</span>
          </div>
          ${msrp > 0 ? `
          <div class="metric">
            <span class="metric-label">MSRP:</span>
            <span>$${msrp.toLocaleString()}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Gap:</span>
            <span>$${gap.toLocaleString()}</span>
          </div>
          ` : ''}
          <div class="metric">
            <span class="metric-label">Confidence:</span>
            <span>${Math.round(scanResult.verdict.confidence_score)}%</span>
          </div>
          <a href="https://margingap.com" class="button">View on MarginGap</a>
        </div>
      </div>
    </body>
    </html>
  `

  try {
    const response = await fetch(emailFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({
        to,
        subject: `MarginGap Alert: ${alert.query_text}`,
        html
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Email send failed:', errorText)
      return false
    }

    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // This function should be called with service role key (scheduled/cron)
    const authHeader = req.headers.get('Authorization')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    // Verify service role key (for cron/scheduled calls)
    if (!authHeader || !authHeader.includes(serviceRoleKey)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - service role key required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase with service role (to bypass RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Get all active alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('product_alerts')
      .select('*')
      .eq('is_active', true)

    if (alertsError) {
      console.error('Fetch alerts error:', alertsError)
      return new Response(
        JSON.stringify({ error: alertsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, triggered: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = {
      processed: 0,
      triggered: 0,
      errors: 0
    }

    // Process each alert
    for (const alert of alerts) {
      results.processed++

      try {
        // Check cooldown
        if (alert.last_triggered_at) {
          const hoursSince = (Date.now() - new Date(alert.last_triggered_at).getTime()) / (1000 * 60 * 60)
          if (hoursSince < COOLDOWN_HOURS) {
            continue // Skip if within cooldown
          }
        }

        // Get user profile for email
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', alert.user_id)
          .single()

        if (!profile || !profile.email) {
          console.warn(`No email for user ${alert.user_id}`)
          continue
        }

        // Call scan-product function
        const scanResponse = await fetch(`${supabaseUrl}/functions/v1/scan-product`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`
          },
          body: JSON.stringify({
            query: alert.query_text,
            region_key: alert.region || 'US',
            scope: alert.scope
          })
        })

        if (!scanResponse.ok) {
          console.error(`Scan failed for alert ${alert.id}`)
          results.errors++
          continue
        }

        const scanResult: ScanResult = await scanResponse.json()

        // Extract MSRP from fair_value_range.high if not provided (common case)
        if (!scanResult.msrp && scanResult.verdict?.fair_value_range?.high) {
          scanResult.msrp = scanResult.verdict.fair_value_range.high
        }

        // Evaluate condition
        const triggered = await evaluateCondition(alert.condition as AlertCondition, scanResult)

        if (triggered) {
          // Send email
          const emailSent = await sendAlertEmail(supabaseUrl, profile.email, alert, scanResult)

          if (emailSent) {
            // Update last_triggered_at
            await supabase
              .from('product_alerts')
              .update({ last_triggered_at: new Date().toISOString() })
              .eq('id', alert.id)

            results.triggered++
          } else {
            results.errors++
          }
        }
      } catch (error) {
        console.error(`Error processing alert ${alert.id}:`, error)
        results.errors++
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Run alerts error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

