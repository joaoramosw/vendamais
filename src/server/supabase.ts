import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Client Supabase de service role da camada `/api` — bypassa RLS, então a
 * autorização é imposta explicitamente nos services (checagem de `admin_id`,
 * token de convite, casamento por e-mail/telefone), nunca delegada ao banco.
 * Mesma convenção do backend NestJS que este módulo substitui e das Server
 * Actions existentes.
 *
 * Memoizado por instância como otimização apenas (o client é um wrapper
 * stateless de fetch) — nada aqui depende de o estado sobreviver entre
 * requisições serverless.
 */
let _client: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  _client ??= createAdminClient();
  return _client;
}
