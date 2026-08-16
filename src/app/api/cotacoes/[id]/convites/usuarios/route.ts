import { NextResponse } from "next/server";
import { apiRoute, parseBody } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { convidarUsuariosSchema } from "@/server/cotacoes/dto";
import { convidarPorUsuarios } from "@/server/cotacoes/cotacoes.service";

/** Convites para usuários específicos (modal de WhatsApp) — dedupe no service. */
export const POST = apiRoute<{ id: string }>(async (request, { params }) => {
  const user = await requireEmpresario(request);
  const { id } = await params;
  const dto = await parseBody(request, convidarUsuariosSchema);
  return NextResponse.json(await convidarPorUsuarios(user.id, id, dto.user_ids), { status: 201 });
});
