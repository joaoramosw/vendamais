import { NextResponse } from "next/server";
import { apiRoute, parseBody } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { gerenciarPropostaSchema } from "@/server/propostas/dto";
import { gerenciarProposta, getPropostaComItens } from "@/server/propostas/propostas.service";

export const GET = apiRoute<{ id: string }>(async (request, { params }) => {
  const user = await requireEmpresario(request);
  const { id } = await params;
  return NextResponse.json(await getPropostaComItens(user.id, id));
});

/** Aceitar/recusar — aceitar fecha a cotação (trava otimista) e recusa as
 * propostas irmãs. */
export const PATCH = apiRoute<{ id: string }>(async (request, { params }) => {
  const user = await requireEmpresario(request);
  const { id } = await params;
  const { status } = await parseBody(request, gerenciarPropostaSchema);
  return NextResponse.json(await gerenciarProposta(user.id, id, status));
});
