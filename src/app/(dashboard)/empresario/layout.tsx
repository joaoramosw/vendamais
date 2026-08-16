import { getCurrentUser } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'

/**
 * Empresario sub-layout.
 *
 * Second line of defence after the cross-domain guard in (dashboard)/layout.tsx.
 * Ensures that only users with role = 'admin' can render
 * any page under the /empresario/* route group.
 *
 * Uses the cached getCurrentUser() — the parent (dashboard) layout already
 * fetched it in this same request, so this call is free (memoized by
 * React's cache()).
 */
export default async function EmpresarioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (user.role !== 'admin') {
    redirect('/fornecedor/dashboard')
  }

  return <>{children}</>
}
