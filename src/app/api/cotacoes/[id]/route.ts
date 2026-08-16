import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { deletarCotacao, detalheCotacao } from "@/server/cotacoes/cotacoes.service";

export const GET = apiRoute<{ id: string }>(async (request, { params }) => {
  const user = await requireEmpresario(request);
  const { id } = await params;
  return NextResponse.json(await detalheCotacao(user.id, id));
});

/** Exclui a cotação e tudo que depende dela — vale para qualquer status. */
export const DELETE = apiRoute<{ id: string }>(async (request, { params }) => {
  const user = await requireEmpresario(request);
  const { id } = await params;
  await deletarCotacao(user.id, id);
  return NextResponse.json({ success: true });
});
