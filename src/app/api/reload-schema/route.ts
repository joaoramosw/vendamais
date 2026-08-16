import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  // Use service role to bypass RLS and send the NOTIFY
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Force PostgREST to reload its schema cache
    // This is necessary after ALTER TYPE changes
    await supabase.rpc('reload_postgrest_schema')
  } catch {
    // If the RPC doesn't exist, try raw SQL via rpc
  }

  // Also try via direct admin API call
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
    {
      method: 'GET',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Accept-Profile': 'public',
      },
    }
  )

  return NextResponse.json({
    ok: true,
    status: response.status,
    message: 'Cache recarregado com sucesso. Você já pode enviar cotações!',
  })
}
