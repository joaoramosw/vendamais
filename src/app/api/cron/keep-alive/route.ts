import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/server/supabase";

/**
 * Keep-alive diário do Supabase — o plano Free pausa o projeto após um
 * período sem atividade. Chamado só pelo Vercel Cron (`vercel.json`), que
 * envia `Authorization: Bearer $CRON_SECRET` automaticamente quando essa env
 * var existe no projeto. Contrato de resposta é próprio desta rota (não o
 * `{ statusCode, message, error }` do resto de `/api/**` em `src/server/http.ts`)
 * porque não é consumida pelo `backend-client.ts` do frontend.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  try {
    const { error } = await adminClient().from("roles").select("id").limit(1);
    if (error) throw error;

    console.log(
      `[Supabase Keep Alive] Status: SUCCESS | Database: reachable | Timestamp: ${new Date().toISOString()}`,
    );
    return NextResponse.json({ success: true, database: "reachable" });
  } catch (error) {
    console.error(
      `[Supabase Keep Alive] Status: ERROR | Database: unreachable | Timestamp: ${new Date().toISOString()}`,
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ success: false, database: "unreachable" }, { status: 500 });
  }
}
