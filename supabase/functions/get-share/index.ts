// Supabase Edge Function: get-share
// Retrieves a shared report by token (public, no auth required)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Get token from URL or body
    const url = new URL(req.url)
    let token = url.searchParams.get('token')
    
    if (!token && req.method === 'POST') {
      try {
        const body = await req.json()
        token = body.token
      } catch {
        // Ignore JSON parse errors
      }
    }

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch share (public read via service role or direct query)
    // Note: We use anon key but the table has RLS - we need to bypass for public shares
    // For now, use service role key for this function
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || supabaseAnonKey
    const supabaseService = createClient(supabaseUrl, serviceRoleKey)

    const { data: share, error: fetchError } = await supabaseService
      .from('shared_reports')
      .select('*')
      .eq('token', token)
      .single()

    if (fetchError || !share) {
      return new Response(
        JSON.stringify({ error: 'Share not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        query: share.query,
        payload: share.payload,
        createdAt: share.created_at
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Get share error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

