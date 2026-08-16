import { NextResponse } from "next/server";
import { apiRoute, parseBody } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { atribuirGrupoSchema } from "@/server/cotacoes/dto";
import { atribuirGrupo } from "@/server/cotacoes/cotacoes.service";

/** Move um lote de cotações para um grupo (grupo_id null = "Sem grupo"). */
export const PATCH = apiRoute(async (request) => {
  const user = await requireEmpresario(request);
  const dto = await parseBody(request, atribuirGrupoSchema);
  return NextResponse.json(await atribuirGrupo(user.id, dto.cotacao_ids, dto.grupo_id ?? null));
});
