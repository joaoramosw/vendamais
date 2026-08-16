import { getUserForEdit } from '@/actions/admin-users'
import { EditUserClient } from '@/components/usuarios/EditUserClient'
import { requirePermission } from '@/lib/auth/guard'
import { notFound } from 'next/navigation'

export const metadata = {
  title: 'Editar Usuário — Venda Mais',
}

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('users.read')
  const { id } = await params

  const result = await getUserForEdit(id)

  if (result.status === 'not_found') notFound()
  if (result.status === 'error') {
    throw new Error(result.error)
  }

  return <EditUserClient user={result.user} />
}
