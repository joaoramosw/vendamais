import { NextResponse } from "next/server";

/** Health check — usado pelo smoke test de deploy. */
export function GET() {
  return NextResponse.json({ ok: true });
}
