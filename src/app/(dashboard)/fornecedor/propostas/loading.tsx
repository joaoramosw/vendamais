import { TableSkeleton } from "@/components/ui/skeletons"

export default function PropostasLoading() {
  return <TableSkeleton title="Minhas propostas" subtitle="Acompanhe o status das propostas enviadas" columns={5} rows={6} showToolbar={false} />
}
