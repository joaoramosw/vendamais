import { TableSkeleton } from "@/components/ui/skeletons"

export default function CategoriasLoading() {
  return <TableSkeleton title="Categorias" subtitle="Organize seus produtos por categoria" columns={4} rows={6} />
}
