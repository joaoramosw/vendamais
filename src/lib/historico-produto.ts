/**
 * Tipos e constantes da série temporal de preço do produto.
 *
 * Ficam FORA de `src/actions/product-history.ts` porque um arquivo
 * `'use server'` só pode exportar funções async — exportar o array de períodos
 * ou o mapa de rótulos de lá quebra o build ("a 'use server' file can only
 * export async functions, found object"). Aqui é módulo comum, importável
 * tanto pela action quanto pelos componentes.
 */

export const PERIODOS = ['7d', '30d', '90d', '180d', '1a'] as const;
export type PeriodoHistorico = (typeof PERIODOS)[number];

export const PERIODO_LABELS: Record<PeriodoHistorico, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  '180d': '180 dias',
  '1a': '1 ano',
};

export const PERIODO_DIAS: Record<PeriodoHistorico, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '1a': 365,
};

/**
 * Agregação: até 90 dias um ponto por dia; acima disso, um por semana.
 *
 * O corte existe para o gráfico não virar ruído — 365 pontos diários num card
 * de ~600px não são legíveis e não carregam informação a mais. Em bucket
 * semanal, "melhor oferta" continua sendo o MÍNIMO do período (é o melhor
 * preço que existiu naquela semana, que é o que interessa), nunca a média.
 */
export const GRANULARIDADE_SEMANAL: PeriodoHistorico[] = ['180d', '1a'];

export interface OfertaHistorico {
  id: string;
  empresa: string;
  valor: number;
  data: string;
  /** Presente quando a oferta veio de uma cotação real (não de cotação de referência). */
  cotacao_id: string | null;
}

export interface PontoHistorico {
  /** Início do bucket, ISO `YYYY-MM-DD`. */
  data: string;
  preco_loja: number | null;
  melhor_oferta: number | null;
  ofertas: OfertaHistorico[];
}

export interface HistoricoProduto {
  periodo: PeriodoHistorico;
  granularidade: 'dia' | 'semana';
  pontos: PontoHistorico[];
  /** Ofertas mais recentes do produto, independentes do período. */
  ofertasAtuais: OfertaHistorico[];
  precoLojaAtual: number | null;
  fontes: {
    /** `false` = migration 019 ainda não rodou; sem série de preço de loja. */
    historicoPrecoLoja: boolean;
    /** `false` = migration 020 ainda não rodou; ofertas de cotação fora. */
    ofertasDeCotacao: boolean;
  };
  error: string | null;
}

/** Chave do bucket a que uma data pertence, em ISO `YYYY-MM-DD`. */
export function chaveBucket(iso: string, semanal: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  if (!semanal) return d.toISOString().slice(0, 10);
  // Segunda-feira da semana (UTC) — âncora estável, independente de fuso.
  const dia = d.getUTCDay();
  const offset = (dia + 6) % 7;
  const segunda = new Date(d);
  segunda.setUTCDate(d.getUTCDate() - offset);
  segunda.setUTCHours(0, 0, 0, 0);
  return segunda.toISOString().slice(0, 10);
}

export function historicoVazio(
  periodo: PeriodoHistorico,
  error: string | null = null,
): HistoricoProduto {
  return {
    periodo,
    granularidade: GRANULARIDADE_SEMANAL.includes(periodo) ? 'semana' : 'dia',
    pontos: [],
    ofertasAtuais: [],
    precoLojaAtual: null,
    fontes: { historicoPrecoLoja: false, ofertasDeCotacao: false },
    error,
  };
}
