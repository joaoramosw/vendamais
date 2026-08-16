import { TableSkeleton } from "@/components/ui/skeletons"

export default function UsuariosLoading() {
  return <TableSkeleton title="Usuários" subtitle="Gerencie o acesso da sua equipe" columns={5} rows={6} />
}
