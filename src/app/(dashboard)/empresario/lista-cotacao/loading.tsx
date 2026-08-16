import { TableSkeleton } from "@/components/ui/skeletons"

export default function ListaCotacaoLoading() {
  return <TableSkeleton title="Lista de cotação" subtitle="Itens selecionados para a próxima cotação" columns={5} rows={6} />
}
