import { getCurrentUser } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'

/**
 * Fornecedor sub-layout.
 *
 * Second line of defence after the cross-domain guard in (dashboard)/layout.tsx.
 * Ensures that only users with role = 'supplier' can render
 * any page under the /fornecedor/* route group.
 *
 * Uses the cached getCurrentUser() — the parent (dashboard) layout already
 * fetched it in this same request, so this call is free (memoized by
 * React's cache()).
 */
export default async function FornecedorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (user.role !== 'supplier') {
    redirect('/empresario/dashboard')
  }

  return <>{children}</>
}
