import { NextResponse } from "next/server";
import { apiRoute, parseBody } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { updateStatusSchema } from "@/server/cotacoes/dto";
import { atualizarStatus } from "@/server/cotacoes/cotacoes.service";

/** Transições de status (encerrar, pausar/retomar, cancelar) — as permitidas
 * são validadas no service (ALLOWED_TRANSITIONS + trava otimista). */
export const PATCH = apiRoute<{ id: string }>(async (request, { params }) => {
  const user = await requireEmpresario(request);
  const { id } = await params;
  const { status } = await parseBody(request, updateStatusSchema);
  return NextResponse.json(await atualizarStatus(user.id, id, status));
});
