import { TableSkeleton } from "@/components/ui/skeletons"

export default function CotacoesLoading() {
  return <TableSkeleton title="Minhas Cotações" subtitle="Acompanhe suas cotações publicadas" columns={6} rows={6} />
}
