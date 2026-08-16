import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * One-time API route to fix the two test user profiles.
 *
 * Uses the service_role key to bypass RLS and ensure both
 * auth.user_metadata and profiles table are in sync.
 *
 * POST /api/fix-profiles
 *
 * Can be safely removed after execution.
 */
export async function POST() {
  const adminClient = createAdminClient()

  const fixes = [
    {
      email: 'lucassantiago789@gmail.com',
      tipo: 'fornecedor' as const,
      global_role: 'user' as const,
    },
    {
      email: 'devjoaoramos@gmail.com',
      tipo: 'empresario' as const,
      global_role: 'super_admin' as const,
    },
  ]

  const results = []

  for (const fix of fixes) {
    // 1. Find user by email
    const { data: userList, error: listError } = await adminClient.auth.admin.listUsers()
    if (listError) {
      results.push({ email: fix.email, success: false, error: listError.message })
      continue
    }

    const targetUser = userList.users.find(
      (u) => u.email?.toLowerCase() === fix.email.toLowerCase()
    )

    if (!targetUser) {
      results.push({ email: fix.email, success: false, error: 'User not found in auth' })
      continue
    }

    // 2. Fix auth.users.user_metadata.tipo
    const currentMeta = targetUser.user_metadata || {}
    const { error: metaError } = await adminClient.auth.admin.updateUserById(targetUser.id, {
      user_metadata: { ...currentMeta, tipo: fix.tipo },
    })

    if (metaError) {
      results.push({ email: fix.email, success: false, error: `auth metadata: ${metaError.message}` })
      continue
    }

    // 3. Fix profiles table
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ tipo: fix.tipo, global_role: fix.global_role })
      .eq('id', targetUser.id)

    if (profileError) {
      results.push({ email: fix.email, success: false, error: `profiles: ${profileError.message}` })
      continue
    }

    results.push({
      email: fix.email,
      success: true,
      userId: targetUser.id,
      applied: {
        'auth.user_metadata.tipo': fix.tipo,
        'profiles.tipo': fix.tipo,
        'profiles.global_role': fix.global_role,
      },
    })
  }

  return NextResponse.json({ results })
}
