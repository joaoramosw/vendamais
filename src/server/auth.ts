import "server-only";
import { ForbiddenException, UnauthorizedException } from "@/server/http";
import { adminClient } from "@/server/supabase";

/**
 * Autenticação/autorização da API — espelho dos guards do backend NestJS
 * (`EmpresarioAuthGuard`/`AuthenticatedGuard`): valida o Supabase access
 * token do header `Authorization: Bearer <token>` e, quando exigido, confere
 * o papel em `users` → `roles.key === 'admin'`.
 *
 * A service role bypassa RLS, então **estas funções são a fronteira de
 * autorização** — toda rota autenticada de /api/** precisa passar por uma
 * delas antes de tocar no banco.
 */

export interface EmpresarioUser {
  id: string;
  nome: string;
  email: string;
  role: "admin";
}

export interface AuthenticatedUser {
  id: string;
  /** E-mail do Supabase Auth — pode ser o sintético da conta criada por
   * telefone (`@phone.vendamais.local`), que nunca deve ir pra UI. */
  email: string;
  whatsapp: string | null;
  nome: string | null;
  nomeEmpresa: string | null;
}

function bearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") ?? undefined;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (!token) {
    throw new UnauthorizedException("Token de acesso ausente.");
  }
  return token;
}

/** Rotas restritas a empresário: token válido + role 'admin' em users/roles. */
export async function requireEmpresario(request: Request): Promise<EmpresarioUser> {
  const token = bearerToken(request);
  const supabase = adminClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new UnauthorizedException("Sessão inválida ou expirada.");
  }

  const { data: row, error: userError } = await supabase
    .from("users")
    .select("id, nome, email, roles(key)")
    .eq("id", user.id)
    .maybeSingle();

  if (userError || !row) {
    throw new ForbiddenException("Usuário não encontrado.");
  }

  const roleKey = (row as unknown as { roles: { key: string } | null }).roles?.key;

  if (roleKey !== "admin") {
    throw new ForbiddenException("Esta ação é restrita a empresários.");
  }

  return {
    id: row.id as string,
    nome: row.nome as string,
    email: row.email as string,
    role: "admin",
  };
}

/**
 * Contexto de qualquer conta logada a partir do access token — sem exigência
 * de role (conta de fornecedor não tem 'admin' em users/roles, mas tem sessão
 * Supabase normal). Usado pelas rotas do fornecedor e pelo fluxo de acesso ao
 * convite; também chamado direto pela página `/proposta/[id]` (server
 * component), que já tem o token da sessão em mãos.
 */
export async function getAuthenticatedUserByToken(token: string): Promise<AuthenticatedUser> {
  const supabase = adminClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user || !user.email) {
    throw new UnauthorizedException("Sessão inválida ou expirada.");
  }

  // Melhor esforço: nem toda conta autenticada tem uma linha em `users`
  // (ex. super_admin legado) — nesse caso o convite só casa por e-mail.
  // `whatsapp` é o telefone de login desde a migração para auth por
  // telefone, e é ele que casa a conta com os convites.
  const { data: row } = await supabase
    .from("users")
    .select("whatsapp, nome, organization_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email,
    whatsapp: row?.whatsapp ?? null,
    nome: row?.nome ?? null,
    nomeEmpresa: row?.organization_name ?? null,
  };
}

export async function requireAutenticado(request: Request): Promise<AuthenticatedUser> {
  return getAuthenticatedUserByToken(bearerToken(request));
}
