import { CotacaoDetalheView } from "@/components/cotacoes/cotacao-detalhe-view";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function CotacaoDetalhesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Dados buscados no client (CotacaoDetalheView) via o backend novo — a
  // query embutida anterior (cotacoes -> cotacao_itens/propostas ->
  // profiles:fornecedor_id) sempre falhava (FK inexistente, fornecedor_id
  // não existe no schema real), fazendo essa página cair em notFound()
  // para toda cotação. Ver CLAUDE.md "Known Issues" e o plano da sessão.
  return <CotacaoDetalheView id={id} />;
}
