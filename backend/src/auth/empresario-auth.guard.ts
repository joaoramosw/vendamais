import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface EmpresarioUser {
  id: string;
  nome: string;
  email: string;
  role: 'admin';
}

/**
 * Guard for empresario-only routes. Validates the Supabase access token
 * from `Authorization: Bearer <token>` and confirms the user's role in
 * `users`/`roles` (migrated by 009_users_roles_permissions.sql) is 'admin'.
 */
@Injectable()
export class EmpresarioAuthGuard implements CanActivate {
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
      error: authError,
    } = await this.supabase.client.auth.getUser(token);

    if (authError || !user) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }

    const { data: row, error: userError } = await this.supabase.client
      .from('users')
      .select('id, nome, email, roles(key)')
      .eq('id', user.id)
      .maybeSingle();

    if (userError || !row) {
      throw new ForbiddenException('Usuário não encontrado.');
    }

    const roleKey = (row as unknown as { roles: { key: string } | null }).roles?.key;

    if (roleKey !== 'admin') {
      throw new ForbiddenException('Esta ação é restrita a empresários.');
    }

    const empresarioUser: EmpresarioUser = {
      id: row.id,
      nome: row.nome,
      email: row.email,
      role: 'admin',
    };

    request.user = empresarioUser;
    return true;
  }
}
