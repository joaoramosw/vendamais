import { getDashboardEmpresario } from "@/actions/dashboard";
import { canAccessUsers } from "@/lib/auth/permissions";
import { getCurrentUserRole } from "@/lib/roles.server";
import { EmpresarioDashboardContent } from "./dashboard-content";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EmpresarioDashboardPage() {
  const [
    data,
    role,
  ] = await Promise.all([
    getDashboardEmpresario(),
    getCurrentUserRole(),
  ])

  const canManageUsers = canAccessUsers(role)

  return (
    <EmpresarioDashboardContent
      data={data}
      canManageUsers={canManageUsers}
    />
  )
}
