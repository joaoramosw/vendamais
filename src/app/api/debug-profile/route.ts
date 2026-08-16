import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  // 1. Check user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ status: "No user found in auth", error: userError })
  }

  // 2. Fetch profile exactly as layout does
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("nome, tipo, empresa, global_role")
    .eq("id", user.id)
    .single()

  return NextResponse.json({
    auth_user_id: user.id,
    profile_data: profile,
    profile_error: profileError,
  })
}
