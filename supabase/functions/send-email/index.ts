// Supabase Edge Function: Send Email
// Sends transactional emails via Resend (or other provider)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface SendEmailRequest {
  to: string
  subject: string
  html: string
  text?: string
}

interface SendEmailResponse {
  success: boolean
  error?: string
  errorCode?: 'EMAIL_NOT_CONFIGURED' | 'RATE_LIMITED' | 'PROVIDER_ERROR'
}

// Simple in-memory rate limiter (per user email)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10 // emails per hour per user
const RATE_WINDOW = 60 * 60 * 1000 // 1 hour in ms

function checkRateLimit(email: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(email)

  if (!record || now > record.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT) {
    return false
  }

  record.count++
  return true
}

async function sendViaResend(request: SendEmailRequest): Promise<SendEmailResponse> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('EMAIL_FROM') || 'alerts@priceintel.com'

  if (!apiKey) {
    return {
      success: false,
      error: 'Email provider not configured',
      errorCode: 'EMAIL_NOT_CONFIGURED',
    }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: request.to,
        subject: request.subject,
        html: request.html,
        text: request.text || request.html.replace(/<[^>]*>/g, ''),
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Resend API error:', errorData)
      return {
        success: false,
        error: `Email provider error: ${response.status}`,
        errorCode: 'PROVIDER_ERROR',
      }
    }

      await response.json() // Response data not needed, just verify success
      return { success: true }
  } catch (error) {
    console.error('Email send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'PROVIDER_ERROR',
    }
  }
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
        JSON.stringify({ success: false, error: 'Unauthorized', errorCode: 'PROVIDER_ERROR' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const request: SendEmailRequest = await req.json()

    // Validate input
    if (!request.to || !request.subject || !request.html) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields', errorCode: 'PROVIDER_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check rate limit
    if (!checkRateLimit(request.to)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please try again later.',
          errorCode: 'RATE_LIMITED' 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send email
    const result = await sendViaResend(request)

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Send email error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'PROVIDER_ERROR',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

