import { listAllUsers } from '@/actions/admin-users'
import { getSegmentos } from '@/actions/fornecedor-segmentos'
import { InviteUserModal } from '@/components/usuarios/InviteUserModal'
import { UsersTable } from '@/components/usuarios/UsersTable'
import { requirePermission } from '@/lib/auth/guard'
import { ShieldCheck, Users } from 'lucide-react'

export const metadata = {
  title: 'Gestão de Usuários — Venda Mais',
}

export default async function UsuariosPage() {
  const user = await requirePermission('users.read')

  const { users, error } = await listAllUsers()
  const { segmentos } = await getSegmentos()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-lg bg-warning-500/15 flex items-center justify-center">
              <ShieldCheck className="h-4.5 w-4.5 text-warning-400" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">Gestão de Usuários</h1>
          </div>
          <p className="text-sm text-neutral-500 ml-10">
            Gerencie papéis, convites e acessos dos usuários.
          </p>
        </div>
        <InviteUserModal />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Total de usuários',
            value: users.length,
            color: 'text-primary-400',
            bg: 'bg-primary-500/10',
          },
          {
            label: 'Administradores',
            value: users.filter(u => u.role === 'admin').length,
            color: 'text-violet-400',
            bg: 'bg-violet-500/10',
          },
          {
            label: 'Fornecedores',
            value: users.filter(u => u.role === 'supplier').length,
            color: 'text-teal-400',
            bg: 'bg-teal-500/10',
          },
        ].map(({ label, value, color, bg }) => (
          <div
            key={label}
            className={`${bg} rounded-xl border border-white/[0.06] px-4 py-3 flex items-center gap-3`}
          >
            <Users className={`h-4 w-4 ${color} shrink-0`} />
            <div>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-[11px] text-neutral-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 rounded-xl px-5 py-4 text-sm text-danger-400">
          Erro ao carregar usuários: {error}
        </div>
      )}

      {/* Table */}
      {!error && <UsersTable users={users} segmentos={segmentos} />}
    </div>
  )
}
