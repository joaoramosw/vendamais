import { NextResponse } from "next/server";
import { apiRoute, parseBody } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { updateCotacaoItemSchema } from "@/server/cotacoes/dto";
import { atualizarItem } from "@/server/cotacoes/cotacoes.service";

/** Ajusta Sugestão e/ou preço manual de um item já existente. */
export const PATCH = apiRoute<{ id: string; itemId: string }>(async (request, { params }) => {
  const user = await requireEmpresario(request);
  const { id, itemId } = await params;
  const dto = await parseBody(request, updateCotacaoItemSchema);
  return NextResponse.json(await atualizarItem(user.id, id, itemId, dto));
});
