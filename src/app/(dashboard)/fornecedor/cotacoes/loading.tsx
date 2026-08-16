import { TableSkeleton } from "@/components/ui/skeletons"

export default function FornecedorCotacoesLoading() {
  return <TableSkeleton title="Cotações recebidas" subtitle="Responda com seus melhores preços" columns={5} rows={6} showToolbar={false} />
}
