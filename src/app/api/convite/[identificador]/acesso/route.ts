import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http";
import { requireAutenticado } from "@/server/auth";
import { acessarComoUsuario } from "@/server/propostas/propostas.service";

/**
 * Acesso com sessão: garante que a conta logada faz parte da cotação —
 * vinculando-a se necessário — e devolve o convite dela, já com o token que
 * o envio da proposta deve usar.
 */
export const POST = apiRoute<{ identificador: string }>(async (request, { params }) => {
  const user = await requireAutenticado(request);
  const { identificador } = await params;
  return NextResponse.json(
    await acessarComoUsuario(identificador, {
      email: user.email,
      whatsapp: user.whatsapp,
      nomeEmpresa: user.nomeEmpresa,
    }),
    { status: 201 },
  );
});
