import { ImpersonationBanner } from "@/components/layout/ImpersonationBanner"
import { Sidebar } from "@/components/layout/sidebar"
import { getCurrentUser } from "@/lib/auth/current-user"
import { canAccessUsers } from "@/lib/auth/permissions"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { ConnectionStatus } from "@/components/ui/connection-status"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) redirect("/login")

  // Users created by an admin with a provisional password must set their own
  // password before accessing the rest of the app.
  if (user.mustChangePassword) {
    redirect("/trocar-senha")
  }

  // Read impersonation state straight from the cookie — the middleware used
  // to relay this via an `x-impersonating` header after an extra role query,
  // but the cookie is already available here for free.
  const cookieStore = await cookies()
  const isImpersonating = user.role === "admin" && Boolean(cookieStore.get("acting_as_user_id")?.value)

  return (
    <div className="flex h-screen print:h-auto bg-neutral-100 dark:bg-neutral-900 transition-colors flex-col overflow-hidden print:overflow-visible">
      {isImpersonating && (
        <div className="print:hidden">
          <ImpersonationBanner />
        </div>
      )}
      <div className="print:hidden">
        <ConnectionStatus />
      </div>
      <div className="flex flex-1 overflow-hidden print:overflow-visible relative">
        <div className="print:hidden">
          <Sidebar
            userRole={user.role}
            userName={user.nome}
            canManageUsers={canAccessUsers(user.role)}
          />
        </div>
        <main className="flex-1 overflow-y-auto print:overflow-visible print:h-auto">
          <div className="p-6 lg:p-8 max-w-7xl mx-auto print:p-0 print:max-w-none">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
