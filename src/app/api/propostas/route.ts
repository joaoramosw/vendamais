import { NextResponse } from "next/server";
import { apiRoute, parseBody } from "@/server/http";
import { enviarPropostaSchema } from "@/server/propostas/dto";
import { enviarProposta } from "@/server/propostas/propostas.service";

/** Público — o fornecedor é identificado pelo token_acesso no body, não por
 * JWT (o modelo real de fornecedor é por convite, sem conta obrigatória). */
export const POST = apiRoute(async (request) => {
  const dto = await parseBody(request, enviarPropostaSchema);
  return NextResponse.json(await enviarProposta(dto), { status: 201 });
});
