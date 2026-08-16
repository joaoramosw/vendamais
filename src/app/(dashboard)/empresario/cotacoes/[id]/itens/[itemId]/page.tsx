import { ItemDetalheView } from "@/components/cotacoes/item-detalhe-view";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Acesso completo a um item da cotação (fornecedores + observações).
 *
 * Mesmo padrão da página da cotação: só o guard de sessão aqui; os dados vêm
 * do backend NestJS no client (ver ItemDetalheView), que é quem sabe montar o
 * ranking sem depender do embed quebrado do PostgREST.
 */
export default async function CotacaoItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <ItemDetalheView cotacaoId={id} itemId={itemId} />;
}
