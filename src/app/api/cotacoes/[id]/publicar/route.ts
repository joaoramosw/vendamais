import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { publicarCotacao } from "@/server/cotacoes/cotacoes.service";

/** rascunho → aberta (idempotente; trava otimista no service). */
export const POST = apiRoute<{ id: string }>(async (request, { params }) => {
  const user = await requireEmpresario(request);
  const { id } = await params;
  return NextResponse.json(await publicarCotacao(user.id, id), { status: 201 });
});
