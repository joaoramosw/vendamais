import { apiRoute } from "@/server/http";
import { requireEmpresario } from "@/server/auth";
import { parseExportQuery } from "@/server/cotacoes/dto";
import { exportarCotacao } from "@/server/cotacoes/cotacoes-export.service";

/** pdfkit/exceljs precisam do runtime Node (fs, streams) — nunca edge. */
export const runtime = "nodejs";

export const GET = apiRoute<{ id: string }>(async (request, { params }) => {
  const user = await requireEmpresario(request);
  const { id } = await params;
  const query = parseExportQuery(request.nextUrl.searchParams);

  const { buffer, filename, mimeType } = await exportarCotacao(user.id, id, query);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
