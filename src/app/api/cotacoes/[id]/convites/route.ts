import { NextResponse } from "next/server";
import { apiRoute, parseBody } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { convidarFornecedorSchema } from "@/server/cotacoes/dto";
import { convidarFornecedor, listarConvites } from "@/server/cotacoes/cotacoes.service";

export const GET = apiRoute<{ id: string }>(async (request, { params }) => {
  const user = await requireEmpresario(request);
  const { id } = await params;
  return NextResponse.json(await listarConvites(user.id, id));
});

export const POST = apiRoute<{ id: string }>(async (request, { params }) => {
  const user = await requireEmpresario(request);
  const { id } = await params;
  const dto = await parseBody(request, convidarFornecedorSchema);
  return NextResponse.json(
    await convidarFornecedor(user.id, id, {
      emailContato: dto.email_contato,
      whatsapp: dto.whatsapp,
      nomeEmpresa: dto.nome_empresa,
    }),
    { status: 201 },
  );
});
