import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http";
import { requireAutenticado } from "@/server/auth";
import { detalharMinhaProposta } from "@/server/fornecedor/fornecedor.service";

/** Detalhe de uma proposta enviada — posse validada por e-mail/telefone. */
export const GET = apiRoute<{ id: string }>(async (request, { params }) => {
  const user = await requireAutenticado(request);
  const { id } = await params;
  return NextResponse.json(await detalharMinhaProposta(user.email, id, user.whatsapp));
});
