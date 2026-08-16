import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { listarPorCotacao } from "@/server/propostas/propostas.service";

export const GET = apiRoute<{ id: string }>(async (request, { params }) => {
  const user = await requireEmpresario(request);
  const { id } = await params;
  return NextResponse.json(await listarPorCotacao(user.id, id));
});
