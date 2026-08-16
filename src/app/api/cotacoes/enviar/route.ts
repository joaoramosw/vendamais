import { NextResponse } from "next/server";
import { apiRoute, parseBody } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { createCotacaoSchema } from "@/server/cotacoes/dto";
import { criarEPublicarCotacao } from "@/server/cotacoes/cotacoes.service";

/** Cria e publica numa chamada só — o caminho do botão "Enviar Cotação". */
export const POST = apiRoute(async (request) => {
  const user = await requireEmpresario(request);
  const dto = await parseBody(request, createCotacaoSchema);
  return NextResponse.json(await criarEPublicarCotacao(user.id, dto), { status: 201 });
});
