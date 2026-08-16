import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { buscarFornecedores } from "@/server/cotacoes/cotacoes.service";

/** Busca fornecedores (role 'supplier') pro seletor do modal de convite. */
export const GET = apiRoute(async (request) => {
  await requireEmpresario(request);
  const params = request.nextUrl.searchParams;
  const busca = params.get("busca") ?? undefined;
  const segmentoId = params.get("segmento_id") ?? undefined;
  return NextResponse.json(await buscarFornecedores(busca, segmentoId));
});
