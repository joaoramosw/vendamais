import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CotacaoStatus, PropostaStatus } from '../cotacoes/cotacoes.types';
import { ConviteStatus } from '../auth/fornecedor-token.service';
import { isEmailSentinela, normalizarWhatsapp } from '../cotacoes/convite-contato.util';

/**
 * Achata um embed do PostgREST.
 *
 * Num relacionamento muitos-para-um (`propostas.cotacao_id -> cotacoes`) o
 * PostgREST devolve **objeto**, não array. O código antigo fazia `[0]` nesse
 * objeto, o que dá `undefined` — e era por isso que o título da cotação vinha
 * `null` e a tela do fornecedor caía no rótulo genérico "Cotação". Aceita as
 * duas formas para não voltar a quebrar se a cardinalidade mudar.
 */
function embedUnico<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? valor[0] ?? null : valor;
}

export interface MeuConvite {
  id: string;
  token_acesso: string;
  status_convite: ConviteStatus;
  proposta_id: string | null;
  email_contato: string | null;
  whatsapp: string | null;
  cotacao: {
    id: string;
    titulo: string;
    status: CotacaoStatus;
    data_limite: string | null;
    created_at: string;
  } | null;
}

export interface MinhaProposta {
  id: string;
  cotacao_id: string;
  status: PropostaStatus;
  valor_total: number | null;
  prazo_entrega: string | null;
  created_at: string;
  cotacao: {
    id: string;
    titulo: string;
    status: CotacaoStatus;
    data_limite: string | null;
  } | null;
}

export interface MinhaPropostaDetalhe extends MinhaProposta {
  itens: Array<{
    id: string;
    produto_nome: string;
    quantidade: number;
    preco_unitario: number;
    observacao: string | null;
    /** `false` = o fornecedor respondeu "não tenho" para este item. */
    disponivel: boolean;
  }>;
}

@Injectable()
export class FornecedorService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Bridges a logged-in fornecedor account to the invites addressed to
   * them — there is no FK between fornecedores_convidados and users (the
   * real schema decouples them entirely, fornecedor normally has no
   * account at all), so this matches by email OR whatsapp instead (convites
   * criados pelo modal de WhatsApp podem não ter e-mail preenchido).
   */
  private async matchingConvidadoIds(email: string, whatsapp?: string | null): Promise<string[]> {
    const ids = new Set<string>();

    const { data: porEmail, error: emailError } = await this.supabase.client
      .from('fornecedores_convidados')
      .select('id')
      .eq('email_contato', email);

    if (emailError) {
      throw new BadRequestException(emailError.message);
    }
    (porEmail ?? []).forEach((c) => ids.add(c.id));

    if (whatsapp) {
      // Convites novos gravam o número na forma canônica (55 + DDD + número);
      // linhas antigas guardam o que foi digitado. Procura pelos dois.
      const variantes = [whatsapp, normalizarWhatsapp(whatsapp)].filter(
        (v): v is string => !!v,
      );

      const { data: porWhatsapp, error: whatsappError } = await this.supabase.client
        .from('fornecedores_convidados')
        .select('id')
        .in('whatsapp', variantes);

      if (whatsappError) {
        throw new BadRequestException(whatsappError.message);
      }
      (porWhatsapp ?? []).forEach((c) => ids.add(c.id));
    }

    return Array.from(ids);
  }

  async listarMeusConvites(email: string, whatsapp?: string | null): Promise<MeuConvite[]> {
    const matchedIds = await this.matchingConvidadoIds(email, whatsapp);
    if (matchedIds.length === 0) return [];

    const { data: convites, error } = await this.supabase.client
      .from('fornecedores_convidados')
      .select('id, cotacao_id, token_acesso, status_convite, email_contato, whatsapp')
      .in('id', matchedIds);

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!convites || convites.length === 0) return [];

    const cotacaoIds = [...new Set(convites.map((c) => c.cotacao_id))];

    const { data: cotacoes, error: cotacoesError } = await this.supabase.client
      .from('cotacoes')
      .select('id, titulo, status, data_limite, created_at')
      .in('id', cotacaoIds);

    if (cotacoesError) {
      throw new BadRequestException(cotacoesError.message);
    }

    const cotacaoById = new Map((cotacoes ?? []).map((c) => [c.id, c]));

    // Convite respondido não guarda o id da proposta em si — precisa buscar
    // a proposta ligada a este convite (fornecedor_convidado_id) pra dar ao
    // front-end um jeito de linkar direto pra Minhas Propostas em vez do
    // link público /proposta/[token], que rejeita convite já respondido.
    const convidadoIds = convites.map((c) => c.id);
    const { data: propostas, error: propostasError } = await this.supabase.client
      .from('propostas')
      .select('id, fornecedor_convidado_id')
      .in('fornecedor_convidado_id', convidadoIds);

    if (propostasError) {
      throw new BadRequestException(propostasError.message);
    }

    const propostaIdByConvidadoId = new Map(
      (propostas ?? []).map((p) => [p.fornecedor_convidado_id, p.id]),
    );

    const resultado = convites.map((convite) => ({
      id: convite.id,
      token_acesso: convite.token_acesso,
      status_convite: convite.status_convite as ConviteStatus,
      proposta_id: propostaIdByConvidadoId.get(convite.id) ?? null,
      email_contato: isEmailSentinela(convite.email_contato) ? null : convite.email_contato,
      whatsapp: convite.whatsapp,
      cotacao: cotacaoById.get(convite.cotacao_id) ?? null,
    }));

    // Ordem padrão: abertas primeiro, depois as mais recentes — é o que o
    // fornecedor mais precisa ver primeiro (cotação esperando resposta).
    return resultado.sort((a, b) => {
      const aAberta = a.cotacao?.status === 'aberta' ? 0 : 1;
      const bAberta = b.cotacao?.status === 'aberta' ? 0 : 1;
      if (aAberta !== bAberta) return aAberta - bAberta;

      const aCreated = a.cotacao?.created_at ? new Date(a.cotacao.created_at).getTime() : 0;
      const bCreated = b.cotacao?.created_at ? new Date(b.cotacao.created_at).getTime() : 0;
      return bCreated - aCreated;
    });
  }

  /**
   * Propostas enviadas pela conta logada — mesma ponte por e-mail OU
   * whatsapp de listarMeusConvites (propostas.fornecedor_id não existe no
   * schema real; a identificação do fornecedor é via fornecedores_convidados,
   * casado por email_contato ou whatsapp). Inclui o título da cotação pra a
   * listagem não depender de embed que o PostgREST não reconhece
   * (profiles:empresario_id).
   */
  async listarMinhasPropostas(email: string, whatsapp?: string | null): Promise<MinhaProposta[]> {
    const matchedIds = await this.matchingConvidadoIds(email, whatsapp);
    if (matchedIds.length === 0) return [];

    const { data, error } = await this.supabase.client
      .from('propostas')
      .select(
        'id, cotacao_id, status, valor_total, prazo_entrega, created_at, cotacoes:cotacao_id(id, titulo, status, data_limite)',
      )
      .in('fornecedor_convidado_id', matchedIds)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return ((data ?? []) as Array<{
      id: string;
      cotacao_id: string;
      status: PropostaStatus;
      valor_total: number | null;
      prazo_entrega: string | null;
      created_at: string;
      cotacoes: MinhaProposta['cotacao'] | Array<MinhaProposta['cotacao']> | null;
    }>).map((proposta) => ({
      id: proposta.id,
      cotacao_id: proposta.cotacao_id,
      status: proposta.status,
      valor_total: proposta.valor_total ?? null,
      prazo_entrega: proposta.prazo_entrega ?? null,
      created_at: proposta.created_at,
      cotacao: embedUnico(proposta.cotacoes),
    }));
  }

  /**
   * Detalhe de uma proposta enviada (itens + dados da cotação) — 2.1.
   * Valida a posse via e-mail ou whatsapp pra que o fornecedor só veja
   * propostas que ele mesmo enviou.
   */
  async detalharMinhaProposta(
    email: string,
    propostaId: string,
    whatsapp?: string | null,
  ): Promise<MinhaPropostaDetalhe> {
    const matchedIds = await this.matchingConvidadoIds(email, whatsapp);
    if (matchedIds.length === 0) {
      throw new NotFoundException('Proposta não encontrada ou não pertence a você.');
    }

    const { data: proposta, error } = await this.supabase.client
      .from('propostas')
      .select(
        'id, cotacao_id, status, valor_total, prazo_entrega, created_at, cotacoes:cotacao_id(id, titulo, status, data_limite)',
      )
      .eq('id', propostaId)
      .in('fornecedor_convidado_id', matchedIds)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!proposta) {
      throw new NotFoundException('Proposta não encontrada ou não pertence a você.');
    }

    // `disponivel` é o que distingue "ofertei R$ 0,00" de "respondi que não
    // tenho" — sem ele a lista enxuta do modal fica ambígua pro fornecedor.
    const { data: itens, error: itensError } = await this.supabase.client
      .from('proposta_itens')
      .select('id, produto_nome, quantidade, preco_unitario, observacao, disponivel')
      .eq('proposta_id', propostaId);

    if (itensError) {
      throw new BadRequestException(itensError.message);
    }

    const cotacoes = (proposta as unknown as {
      cotacoes: MinhaProposta['cotacao'] | Array<MinhaProposta['cotacao']> | null;
    }).cotacoes;

    return {
      id: proposta.id,
      cotacao_id: proposta.cotacao_id,
      status: proposta.status,
      valor_total: proposta.valor_total ?? null,
      prazo_entrega: proposta.prazo_entrega ?? null,
      created_at: proposta.created_at,
      cotacao: embedUnico(cotacoes),
      itens: itens ?? [],
    };
  }
}
