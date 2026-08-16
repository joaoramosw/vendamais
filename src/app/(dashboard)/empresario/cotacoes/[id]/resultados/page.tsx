import { redirect } from "next/navigation";

/** A tela de resultado foi unificada com a de detalhe da cotação — este link
 * antigo (favoritos, mensagens já enviadas) continua funcionando via redirect
 * em vez de virar 404. Ver [id]/page.tsx / cotacao-detalhe-view.tsx. */
export default async function ResultadosCotacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/empresario/cotacoes/${id}`);
}
