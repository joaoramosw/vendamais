import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http";
import { requireAutenticado } from "@/server/auth";
import { listarMeusConvites } from "@/server/fornecedor/fornecedor.service";

/** "Cotações Ativas" do fornecedor — convites casados por e-mail/telefone. */
export const GET = apiRoute(async (request) => {
  const user = await requireAutenticado(request);
  return NextResponse.json(await listarMeusConvites(user.email, user.whatsapp));
});
