import { NextResponse } from "next/server";
import { getTheme } from "@/lib/theme/get-theme";

/**
 * GET /api/tema — leitura pública do tema ativo. Sem auth (tema é público
 * por natureza). Escritas NÃO passam por aqui — ver src/actions/theme.ts.
 */
export async function GET() {
  const theme = await getTheme();
  return NextResponse.json(theme, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
