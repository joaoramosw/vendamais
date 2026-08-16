import { TableSkeleton } from "@/components/ui/skeletons"

export default function RankingLoading() {
  return <TableSkeleton title="Ranking de fornecedores" subtitle="Comparativo de desempenho" columns={5} rows={6} showToolbar={false} />
}
