import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { resultadoPorItem } from "@/server/propostas/propostas.service";

/** Ranking por item (1º/2º/3º, menor preço vence) — só 'aberta'/'fechada'. */
export const GET = apiRoute<{ id: string }>(async (request, { params }) => {
  const user = await requireEmpresario(request);
  const { id } = await params;
  return NextResponse.json(await resultadoPorItem(user.id, id));
});
