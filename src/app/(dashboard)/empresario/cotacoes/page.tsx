import { CotacoesListClient } from "@/components/cotacoes/cotacoes-list-client";
import { TableSkeleton } from "@/components/ui/skeletons";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function CotacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Dados são buscados no client (CotacoesListClient) via o backend novo —
  // ver src/lib/api/cotacoes-api.ts. A query direta daqui foi removida
  // porque dependia de um embed PostgREST (cotacoes -> cotacao_itens/propostas)
  // que sempre falhava (FK inexistente no banco real — ver CLAUDE.md).
  // Suspense é necessário porque o client usa useSearchParams (?aberta=<id>).
  return (
    <Suspense fallback={<TableSkeleton showToolbar={false} columns={4} rows={5} />}>
      <CotacoesListClient />
    </Suspense>
  );
}
