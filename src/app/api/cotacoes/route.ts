import { NextResponse } from "next/server";
import { apiRoute, parseBody } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { createCotacaoSchema } from "@/server/cotacoes/dto";
import { criarCotacao, listarCotacoes } from "@/server/cotacoes/cotacoes.service";

export const GET = apiRoute(async (request) => {
  const user = await requireEmpresario(request);
  return NextResponse.json(await listarCotacoes(user.id));
});

/** Cria um 'rascunho' sem publicar (usado pela fila offline). */
export const POST = apiRoute(async (request) => {
  const user = await requireEmpresario(request);
  const dto = await parseBody(request, createCotacaoSchema);
  return NextResponse.json(await criarCotacao(user.id, dto), { status: 201 });
});
