// Supabase Edge Function: Evaluate Alerts
// Evaluates alert rules and triggers notifications (foundation only, no cron)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface EvaluateAlertsResponse {
  triggered: number
  skipped: number
  errors: string[]
}

async function evaluateAlertsForUser(userId: string): Promise<EvaluateAlertsResponse> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const result: EvaluateAlertsResponse = {
    triggered: 0,
    skipped: 0,
    errors: [],
  }

  try {
    // Fetch enabled alert rules with watchlist items
    const { data: rules, error: rulesError } = await supabase
      .from('alert_rules')
      .select(`
        *,
        watchlist_item:watchlist_items(*)
      `)
      .eq('user_id', userId)
      .eq('enabled', true)

    if (rulesError) {
      result.errors.push(`Failed to fetch rules: ${rulesError.message}`)
      return result
    }

    if (!rules || rules.length === 0) {
      return result
    }

    // Fetch user profile for email opt-in check
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, email_opt_in')
      .eq('id', userId)
      .single()

    if (!profile?.email_opt_in) {
      result.errors.push('User has email notifications disabled')
      return result
    }

    // Evaluate each rule
    for (const rule of rules) {
      try {
        const watchlistItem = rule.watchlist_item
        if (!watchlistItem || !watchlistItem.last_price) {
          result.skipped++
          continue
        }

        // Check cooldown
        if (rule.last_triggered_at) {
          const lastTriggered = new Date(rule.last_triggered_at)
          const cooldownMs = rule.cooldown_hours * 60 * 60 * 1000
          const now = new Date()
          if (now.getTime() - lastTriggered.getTime() < cooldownMs) {
            result.skipped++
            continue
          }
        }

        // Evaluate rule
        let shouldTrigger = false
        const currentPrice = watchlistItem.last_price
        const changePct = watchlistItem.last_change_pct || 0

        switch (rule.rule_type) {
          case 'PRICE_BELOW':
            shouldTrigger = currentPrice < rule.threshold
            break
          case 'PRICE_ABOVE':
            shouldTrigger = currentPrice > rule.threshold
            break
          case 'PCT_DROP':
            shouldTrigger = changePct < -Math.abs(rule.threshold)
            break
          case 'PCT_RISE':
            shouldTrigger = changePct > Math.abs(rule.threshold)
            break
        }

        if (!shouldTrigger) {
          result.skipped++
          continue
        }

        // Trigger alert
        const payload = {
          price: currentPrice,
          change_pct: changePct,
          threshold: rule.threshold,
          rule_type: rule.rule_type,
          source: 'evaluate-alerts',
          watchlist_item_title: watchlistItem.title,
        }

        // Create alert event
        const { error: eventError } = await supabase
          .from('alert_events')
          .insert({
            user_id: userId,
            rule_id: rule.id,
            payload,
          })

        if (eventError) {
          result.errors.push(`Failed to create event for rule ${rule.id}: ${eventError.message}`)
          continue
        }

        // Update rule last_triggered_at
        await supabase
          .from('alert_rules')
          .update({ last_triggered_at: new Date().toISOString() })
          .eq('id', rule.id)

        // Send email notification
        const emailSubject = `Price Alert: ${watchlistItem.title}`
        const emailHtml = `
          <h2>Price Alert Triggered</h2>
          <p><strong>Product:</strong> ${watchlistItem.title}</p>
          <p><strong>Current Price:</strong> $${currentPrice.toFixed(2)}</p>
          ${changePct !== 0 ? `<p><strong>Change:</strong> ${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%</p>` : ''}
          <p><strong>Rule:</strong> ${rule.rule_type} ${rule.threshold}${rule.rule_type.includes('PCT') ? '%' : '$'}</p>
          <p><a href="${Deno.env.get('APP_URL') || 'https://priceintel.com'}">View Details</a></p>
        `

        // Call send-email function
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: profile.email,
            subject: emailSubject,
            html: emailHtml,
          }),
        })

        if (!emailResponse.ok) {
          result.errors.push(`Failed to send email for rule ${rule.id}`)
        } else {
          result.triggered++
        }
      } catch (error) {
        result.errors.push(`Error evaluating rule ${rule.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  } catch (error) {
    result.errors.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return result
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get auth user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ triggered: 0, skipped: 0, errors: ['Unauthorized'] }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract user ID from JWT or request body
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ triggered: 0, skipped: 0, errors: ['Unauthorized'] }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Evaluate alerts for user
    const result = await evaluateAlertsForUser(user.id)

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Evaluate alerts error:', error)
    return new Response(
      JSON.stringify({ 
        triggered: 0, 
        skipped: 0, 
        errors: [error instanceof Error ? error.message : 'Unknown error'] 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

