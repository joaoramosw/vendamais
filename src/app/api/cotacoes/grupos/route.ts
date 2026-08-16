import { NextResponse } from "next/server";
import { apiRoute, parseBody } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { grupoNomeSchema } from "@/server/cotacoes/dto";
import { criarGrupo, listarGrupos } from "@/server/cotacoes/cotacoes.service";

export const GET = apiRoute(async (request) => {
  const user = await requireEmpresario(request);
  return NextResponse.json(await listarGrupos(user.id));
});

export const POST = apiRoute(async (request) => {
  const user = await requireEmpresario(request);
  const { nome } = await parseBody(request, grupoNomeSchema);
  return NextResponse.json(await criarGrupo(user.id, nome), { status: 201 });
});
