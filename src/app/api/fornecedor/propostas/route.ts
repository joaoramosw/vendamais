import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http";
import { requireAutenticado } from "@/server/auth";
import { listarMinhasPropostas } from "@/server/fornecedor/fornecedor.service";

/** "Minhas Propostas" do fornecedor. */
export const GET = apiRoute(async (request) => {
  const user = await requireAutenticado(request);
  return NextResponse.json(await listarMinhasPropostas(user.email, user.whatsapp));
});
