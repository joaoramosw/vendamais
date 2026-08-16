import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface AuthenticatedUser {
  id: string;
  /** E-mail do Supabase Auth — pode ser o sintético da conta criada por
   * telefone (`@phone.vendamais.local`), que nunca deve ir pra UI. */
  email: string;
  whatsapp: string | null;
  nome: string | null;
  nomeEmpresa: string | null;
}

/**
 * Lighter than EmpresarioAuthGuard — just validates the Supabase access
 * token, no role check. Used by routes any logged-in account can hit
 * (e.g. a fornecedor account, which has no `role: admin` entry in
 * users/roles but still has a normal Supabase Auth session).
 */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException('Token de acesso ausente.');
    }

    const {
      data: { user },
      error,
    } = await this.supabase.client.auth.getUser(token);

    if (error || !user || !user.email) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }

    // Melhor esforço: nem toda conta autenticada tem uma linha em `users`
    // (ex. super_admin legado) — nesse caso o convite só casa por e-mail.
    // `whatsapp` é o telefone de login desde a migração para auth por
    // telefone, e é ele que casa a conta com os convites.
    const { data: row } = await this.supabase.client
      .from('users')
      .select('whatsapp, nome, organization_name')
      .eq('id', user.id)
      .maybeSingle();

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      whatsapp: row?.whatsapp ?? null,
      nome: row?.nome ?? null,
      nomeEmpresa: row?.organization_name ?? null,
    };
    request.user = authenticatedUser;
    return true;
  }
}
