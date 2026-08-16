import { getInvitationByToken } from '@/actions/invitations'
import { Logo } from '@/components/brand/logo'
import { AcceptInviteForm } from '@/components/usuarios/AcceptInviteForm'
import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import type { RoleKey } from '@/lib/types/database'
import { AlertCircle, UserCheck } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function ConvitePage({ params }: PageProps) {
  const { token } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    redirect('/empresario/dashboard')
  }

  const { invitation, error } = await getInvitationByToken(token)

  if (error || !invitation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-900 px-4 py-12">
        <Logo variant="full" scheme="dark" size="md" className="mb-6" priority />
        <div className="w-full max-w-md bg-neutral-900 border border-white/[0.08] rounded-2xl p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger-500/10 mb-6">
            <AlertCircle className="h-8 w-8 text-danger-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Convite Invalido</h2>
          <p className="text-sm text-neutral-400 mb-8">{error}</p>
          <Link
            href="/login"
            className="inline-flex justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
          >
            Voltar para o Login
          </Link>
        </div>
      </div>
    )
  }

  const roleLabel = ROLE_LABELS[(invitation.role as RoleKey) ?? 'supplier']

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-900 px-4 py-12">
      <Logo variant="full" scheme="dark" size="md" className="mb-6" priority />
      <div className="w-full max-w-md bg-neutral-900 border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-500/10 mb-6">
          <UserCheck className="h-8 w-8 text-primary-400" />
        </div>
        
        <h2 className="text-2xl font-bold text-white text-center mb-2 tracking-tight">
          Voce foi convidado!
        </h2>
        <p className="text-sm text-neutral-400 text-center mb-8">
          Voce foi convidado para participar da Venda Mais como{' '}
          <span className="capitalize font-medium text-primary-400">{roleLabel}</span>.
        </p>

        <AcceptInviteForm token={token} />
      </div>
    </div>
  )
}
