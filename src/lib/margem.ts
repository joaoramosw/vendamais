/**
 * margem.ts — Motor de margem / valor ideal de compra (puro, sem I/O).
 *
 * Segue a convenção "puro vs. I/O" do projeto (ver `roles.ts` vs
 * `roles.server.ts`): aqui só há função pura, testável sem mock
 * (`margem.test.ts`). A leitura/gravação da configuração vive em
 * `src/actions/margem.ts`.
 *
 * Consumido pelos DOIS caminhos de renderização da tabela de comparação
 * (desktop e mobile) — não duplicar essa lógica em componente.
 */

export type MetodoCalculoMargem = 'markup' | 'desconto';

export interface MargemConfig {
  /** Margem em porcentagem (ex.: 28.5 = 28,5%). */
  margem_percent: number;
  /** Faixa em porcentagem em torno do valor ideal tratada como "igual". */
  tolerancia_percent: number;
  metodo: MetodoCalculoMargem;
}

/**
 * Padrão do sistema. `markup` é o método ativo: a margem é aplicada COMO
 * MARKUP sobre o custo de compra, então o valor ideal de compra é o preço de
 * loja dividido pelo multiplicador de markup.
 */
export const DEFAULT_MARGEM_CONFIG: MargemConfig = {
  margem_percent: 28.5,
  tolerancia_percent: 0.5,
  metodo: 'markup',
};

export const METODO_CALCULO_LABELS: Record<MetodoCalculoMargem, string> = {
  markup: 'Markup sobre o custo',
  desconto: 'Desconto sobre o preço de venda',
};

export const METODO_CALCULO_FORMULAS: Record<MetodoCalculoMargem, string> = {
  markup: 'preço loja ÷ (1 + margem)',
  desconto: 'preço loja × (1 − margem)',
};

/**
 * Arredondamento half-up (metade "pra longe do zero"), 2 casas por padrão.
 *
 * O `toFixed(6)` intermediário existe pra neutralizar erro de representação
 * binária antes do corte: `77.815 * 100` vale `7781.499999999999` em ponto
 * flutuante e cairia pra 77.81 num `Math.round` direto, quando o esperado
 * (half-up) é 77.82.
 */
export function roundHalfUp(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  const scaled = Number((Math.abs(value) * factor).toFixed(6));
  const rounded = Math.round(scaled) / factor;
  return value < 0 ? -rounded : rounded;
}

/**
 * Valor ideal de COMPRA para um produto, dado o preço praticado na loja.
 *
 * - `markup` (padrão): `precoLoja ÷ (1 + margem)` — ex.: R$ 100,00 a 28,5%
 *   → 100 ÷ 1,285 = R$ 77,82.
 * - `desconto`: `precoLoja × (1 − margem)` — ex.: R$ 100,00 a 28,5%
 *   → R$ 71,50.
 *
 * Retorna `null` quando não há base de cálculo (preço de loja ausente ou
 * não positivo) — a UI precisa distinguir "sem preço de loja cadastrado" de
 * "valor ideal igual a zero".
 */
export function calcularValorIdeal(
  precoLoja: number | null | undefined,
  margemPercent: number,
  metodo: MetodoCalculoMargem = 'markup',
): number | null {
  if (precoLoja == null || !Number.isFinite(precoLoja) || precoLoja <= 0) return null;
  if (!Number.isFinite(margemPercent)) return null;

  const margem = margemPercent / 100;

  if (metodo === 'desconto') {
    const fator = 1 - margem;
    // Margem ≥ 100% zeraria/negativaria o valor ideal — sem sentido como
    // preço de compra, então tratamos como "não calculável".
    if (fator <= 0) return null;
    return roundHalfUp(precoLoja * fator);
  }

  const multiplicador = 1 + margem;
  if (multiplicador <= 0) return null;
  return roundHalfUp(precoLoja / multiplicador);
}

/**
 * Preço de VENDA sugerido a partir de um custo de compra — o inverso exato de
 * `calcularValorIdeal`, usado pelo simulador da página do produto.
 *
 * - `markup` (padrão): `custo × (1 + margem)` — ex.: R$ 77,82 a 28,5%
 *   → R$ 100,00 (fecha o ciclo com o exemplo de `calcularValorIdeal`).
 * - `desconto`: `custo ÷ (1 − margem)`.
 *
 * Retorna `null` quando não há base de cálculo (custo ausente/não positivo) ou
 * quando a margem torna a conta impossível — a UI precisa distinguir "sem
 * custo informado" de "preço zero".
 */
export function calcularPrecoVenda(
  custoCompra: number | null | undefined,
  margemPercent: number,
  metodo: MetodoCalculoMargem = 'markup',
): number | null {
  if (custoCompra == null || !Number.isFinite(custoCompra) || custoCompra <= 0) return null;
  if (!Number.isFinite(margemPercent)) return null;

  const margem = margemPercent / 100;

  if (metodo === 'desconto') {
    const fator = 1 - margem;
    if (fator <= 0) return null;
    return roundHalfUp(custoCompra / fator);
  }

  const multiplicador = 1 + margem;
  if (multiplicador <= 0) return null;
  return roundHalfUp(custoCompra * multiplicador);
}

/**
 * Estado do indicador de tendência de um valor ofertado em relação ao ideal:
 *
 * - `acima`  — fornecedor caro, fora da margem (seta pra cima, vermelho)
 * - `igual`  — dentro da tolerância (sinal de igual, neutro)
 * - `abaixo` — fornecedor barato, dentro/melhor que a margem (seta pra
 *   baixo, verde)
 */
export type TendenciaEstado = 'acima' | 'igual' | 'abaixo';

/**
 * Compara um valor ofertado com o valor ideal.
 *
 * A comparação exata de decimais é impraticável (o ideal é sempre resultado
 * de uma divisão), por isso a faixa "igual" é uma tolerância percentual
 * configurável em torno do ideal — ±0,5% por padrão.
 *
 * Retorna `null` quando não há ideal calculável (produto sem preço de loja).
 */
export function avaliarTendencia(
  valorOfertado: number | null | undefined,
  valorIdeal: number | null | undefined,
  toleranciaPercent: number = DEFAULT_MARGEM_CONFIG.tolerancia_percent,
): TendenciaEstado | null {
  if (valorOfertado == null || !Number.isFinite(valorOfertado)) return null;
  if (valorIdeal == null || !Number.isFinite(valorIdeal) || valorIdeal <= 0) return null;

  const tolerancia = Number.isFinite(toleranciaPercent) ? Math.abs(toleranciaPercent) : 0;
  const folga = valorIdeal * (tolerancia / 100);

  if (valorOfertado > valorIdeal + folga) return 'acima';
  if (valorOfertado < valorIdeal - folga) return 'abaixo';
  return 'igual';
}

/** Diferença percentual do ofertado em relação ao ideal (positiva = mais
 * caro). Usada só como texto de apoio (tooltip), nunca pra decidir o estado
 * — quem decide é `avaliarTendencia`. */
export function diferencaPercentual(
  valorOfertado: number | null | undefined,
  valorIdeal: number | null | undefined,
): number | null {
  if (valorOfertado == null || !Number.isFinite(valorOfertado)) return null;
  if (valorIdeal == null || !Number.isFinite(valorIdeal) || valorIdeal <= 0) return null;
  return roundHalfUp(((valorOfertado - valorIdeal) / valorIdeal) * 100, 2);
}

/** Normaliza qualquer coisa vinda do banco/localStorage para uma config
 * válida, caindo no padrão campo a campo (config parcial gravada por uma
 * versão anterior não deve invalidar o resto). */
export function normalizarMargemConfig(raw: unknown): MargemConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MARGEM_CONFIG };
  const obj = raw as Record<string, unknown>;

  const margem = Number(obj.margem_percent);
  const tolerancia = Number(obj.tolerancia_percent);
  const metodo = obj.metodo;

  return {
    margem_percent:
      Number.isFinite(margem) && margem >= 0 && margem < 1000
        ? margem
        : DEFAULT_MARGEM_CONFIG.margem_percent,
    tolerancia_percent:
      Number.isFinite(tolerancia) && tolerancia >= 0 && tolerancia <= 100
        ? tolerancia
        : DEFAULT_MARGEM_CONFIG.tolerancia_percent,
    metodo: metodo === 'desconto' || metodo === 'markup' ? metodo : DEFAULT_MARGEM_CONFIG.metodo,
  };
}
