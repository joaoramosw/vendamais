import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  digitosDoTelefone,
  emailSentinelaParaWhatsapp,
  isEmailSentinela,
  normalizarWhatsapp,
} from '../cotacoes/convite-contato.util';

export type ConviteStatus = 'pendente' | 'visualizado' | 'respondido';

export interface FornecedorConvidado {
  id: string;
  cotacao_id: string;
  token_acesso: string;
  email_contato: string | null;
  whatsapp: string | null;
  nome_empresa: string | null;
  status_convite: ConviteStatus;
}

const CONVIDADO_COLUNAS =
  'id, cotacao_id, token_acesso, email_contato, whatsapp, nome_empresa, status_convite';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O convite é o que dá acesso à cotação do lado do fornecedor. Historicamente
 * o único identificador era o `token_acesso`; hoje a rota pública é
 * `/proposta/{id}` e esse `{id}` pode ser **o token do convite ou o id de uma
 * proposta já enviada** (link antigo salvo, link colado de outra tela). Este
 * serviço é o único lugar que resolve os dois.
 */
@Injectable()
export class FornecedorTokenService {
  constructor(private readonly supabase: SupabaseService) {}

  async validateToken(token: string): Promise<FornecedorConvidado> {
    const { data, error } = await this.supabase.client
      .from('fornecedores_convidados')
      .select(CONVIDADO_COLUNAS)
      .eq('token_acesso', token)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException('Convite não encontrado.');
    }

    return data as FornecedorConvidado;
  }

  /**
   * Resolve `token_acesso` **ou** `propostas.id`. A busca por token vem
   * primeiro (caminho normal, um SELECT só); o id de proposta só é tentado
   * quando o identificador tem cara de UUID e nenhum convite bateu.
   */
  async resolveConvite(identificador: string): Promise<FornecedorConvidado> {
    const { data, error } = await this.supabase.client
      .from('fornecedores_convidados')
      .select(CONVIDADO_COLUNAS)
      .eq('token_acesso', identificador)
      .maybeSingle();

    if (error) {
      throw new NotFoundException('Convite não encontrado.');
    }

    if (data) return data as FornecedorConvidado;

    if (!UUID_RE.test(identificador)) {
      throw new NotFoundException('Convite não encontrado.');
    }

    const { data: proposta } = await this.supabase.client
      .from('propostas')
      .select('id, fornecedor_convidado_id')
      .eq('id', identificador)
      .maybeSingle();

    if (!proposta) {
      throw new NotFoundException('Convite não encontrado.');
    }

    const { data: convidado } = await this.supabase.client
      .from('fornecedores_convidados')
      .select(CONVIDADO_COLUNAS)
      .eq('id', proposta.fornecedor_convidado_id)
      .maybeSingle();

    if (!convidado) {
      throw new NotFoundException('Convite não encontrado.');
    }

    return convidado as FornecedorConvidado;
  }

  /** Convite pelo id da linha — usado depois de criar/casar um vínculo. */
  async byId(convidadoId: string): Promise<FornecedorConvidado> {
    const { data } = await this.supabase.client
      .from('fornecedores_convidados')
      .select(CONVIDADO_COLUNAS)
      .eq('id', convidadoId)
      .maybeSingle();

    if (!data) {
      throw new NotFoundException('Convite não encontrado.');
    }

    return data as FornecedorConvidado;
  }

  async markVisualizado(convidado: FornecedorConvidado): Promise<void> {
    if (convidado.status_convite !== 'pendente') return;

    await this.supabase.client
      .from('fornecedores_convidados')
      .update({ status_convite: 'visualizado' })
      .eq('id', convidado.id)
      .eq('status_convite', 'pendente'); // optimistic lock
  }

  async validateTokenForSubmission(token: string): Promise<FornecedorConvidado> {
    const convidado = await this.validateToken(token);

    if (convidado.status_convite === 'respondido') {
      throw new ConflictException('Este convite já recebeu uma proposta.');
    }

    return convidado;
  }

  async markRespondido(
    convidado: FornecedorConvidado,
    whatsapp?: string,
    nomeEmpresa?: string,
  ): Promise<void> {
    await this.supabase.client
      .from('fornecedores_convidados')
      .update({
        status_convite: 'respondido',
        ...(whatsapp ? { whatsapp } : {}),
        ...(nomeEmpresa ? { nome_empresa: nomeEmpresa } : {}),
      })
      .eq('id', convidado.id);
  }

  /**
   * Liga a conta logada à cotação do convite — o passo final do fluxo de
   * acesso por link (Cenário B): quem entrou/cadastrou pelo link precisa
   * "fazer parte" da cotação para que a próxima visita já caia direto no
   * formulário e a cotação apareça em "Cotações Ativas".
   *
   * Três desfechos, nesta ordem:
   *   1. o convite do link já é da própria pessoa → nada a fazer;
   *   2. existe outro convite da mesma cotação endereçado a ela (o link foi
   *      repassado, mas ela também tinha sido convidada) → usa aquele;
   *   3. nenhum → cria um convite próprio, com token próprio.
   *
   * O passo 3 é deliberado: **nunca** sobrescrever o contato de um convite
   * existente. O link circula por WhatsApp e é repassado; reescrever a linha
   * roubaria o convite de quem o empresário chamou de verdade, e o vencedor da
   * cotação apareceria com o contato errado.
   */
  async vincularUsuario(
    convite: FornecedorConvidado,
    usuario: { email: string | null; whatsapp: string | null; nomeEmpresa?: string | null },
  ): Promise<{ convite: FornecedorConvidado; criado: boolean }> {
    const telefone = normalizarWhatsapp(usuario.whatsapp);
    const emailReal = isEmailSentinela(usuario.email) ? null : usuario.email?.toLowerCase() || null;

    if (!telefone && !emailReal) {
      throw new BadRequestException(
        'Sua conta está sem telefone cadastrado — atualize seu cadastro para responder cotações.',
      );
    }

    const pertenceAoUsuario = (linha: FornecedorConvidado): boolean => {
      const mesmoTelefone =
        !!telefone && digitosDoTelefone(linha.whatsapp) === digitosDoTelefone(telefone);
      const mesmoEmail =
        !!emailReal && !isEmailSentinela(linha.email_contato) &&
        linha.email_contato?.toLowerCase() === emailReal;
      return mesmoTelefone || mesmoEmail;
    };

    if (pertenceAoUsuario(convite)) {
      return { convite, criado: false };
    }

    const { data: daCotacao, error } = await this.supabase.client
      .from('fornecedores_convidados')
      .select(CONVIDADO_COLUNAS)
      .eq('cotacao_id', convite.cotacao_id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const jaConvidado = ((daCotacao ?? []) as FornecedorConvidado[]).find(pertenceAoUsuario);
    if (jaConvidado) {
      return { convite: jaConvidado, criado: false };
    }

    const { data: novo, error: insertError } = await this.supabase.client
      .from('fornecedores_convidados')
      .insert({
        cotacao_id: convite.cotacao_id,
        // email_contato é NOT NULL no banco (ver convite-contato.util.ts) e o
        // e-mail sintético da conta nunca é gravado aqui.
        email_contato: emailReal ?? emailSentinelaParaWhatsapp(telefone!),
        whatsapp: telefone,
        nome_empresa: usuario.nomeEmpresa?.trim() || null,
      })
      .select(CONVIDADO_COLUNAS)
      .single();

    if (insertError || !novo) {
      throw new BadRequestException(
        insertError?.message ?? 'Não foi possível vincular você a esta cotação.',
      );
    }

    return { convite: novo as FornecedorConvidado, criado: true };
  }
}
