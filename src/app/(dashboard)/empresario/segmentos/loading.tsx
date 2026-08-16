import { TableSkeleton } from "@/components/ui/skeletons"

export default function SegmentosLoading() {
  return <TableSkeleton title="Segmentos" subtitle="Agrupe fornecedores por segmento" columns={3} rows={5} />
}
