import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http";
import { getConvite } from "@/server/propostas/propostas.service";

/**
 * Público — pré-visualização do convite para quem abre o link **sem estar
 * logado**. `identificador` é o token do convite ou o id de uma proposta já
 * enviada (links antigos continuam funcionando).
 */
export const GET = apiRoute<{ identificador: string }>(async (_request, { params }) => {
  const { identificador } = await params;
  return NextResponse.json(await getConvite(identificador));
});
