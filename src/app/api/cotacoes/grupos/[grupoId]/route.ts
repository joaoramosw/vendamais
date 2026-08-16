import { NextResponse } from "next/server";
import { apiRoute, parseBody } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { grupoNomeSchema } from "@/server/cotacoes/dto";
import { excluirGrupo, renomearGrupo } from "@/server/cotacoes/cotacoes.service";

export const PATCH = apiRoute<{ grupoId: string }>(async (request, { params }) => {
  const user = await requireEmpresario(request);
  const { grupoId } = await params;
  const { nome } = await parseBody(request, grupoNomeSchema);
  return NextResponse.json(await renomearGrupo(user.id, grupoId, nome));
});

/** Apaga só o grupo — as cotações voltam para "Sem grupo". */
export const DELETE = apiRoute<{ grupoId: string }>(async (request, { params }) => {
  const user = await requireEmpresario(request);
  const { grupoId } = await params;
  await excluirGrupo(user.id, grupoId);
  return NextResponse.json({ success: true });
});
