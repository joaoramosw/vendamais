import { decimalToCents, centsToDecimal } from './utils';

/**
 * Motor de Preços e Margens
 * Funções puras e livre de side-effects para garantir cálculos financeiros seguros.
 */

/**
 * 1. Calcula o preço final a partir de um preço base e uma margem em porcentagem.
 * Resolve problemas de precisão arredondando sempre via centavos.
 * 
 * @param basePrice Preço base em formato decimal (ex: 10.50)
 * @param marginPercentage Margem em porcentagem (ex: 30 para +30%, -10 para -10%)
 * @returns Preço final com margem aplicada em decimal
 */
export function calculatePriceWithMargin(basePrice: number, marginPercentage: number): number {
  if (basePrice < 0) {
    throw new Error("Motor de Preços: O preço base não pode ser negativo.");
  }

  const baseCents = decimalToCents(basePrice);
  
  // O fator de multiplicação (ex: 30% vira 1.30, -10% vira 0.90)
  const multiplier = 1 + (marginPercentage / 100);
  
  // Arredonda para o centavo mais próximo (Round half to even/up dependendo do Math.round)
  const finalCents = Math.round(baseCents * multiplier);
  
  // Segurança: evitar preços negativos mesmo se a margem for muito negativa (ex: -150%)
  const safeFinalCents = Math.max(0, finalCents);

  return centsToDecimal(safeFinalCents);
}

/**
 * 2. Cálculo Reverso: Descobre qual foi a margem aplicada considerando um preço base e um final.
 * 
 * @param basePrice Preço de custo original
 * @param finalPrice Preço de venda praticado
 * @returns A margem percentual equivalente (ex: 33.33)
 */
export function calculateMarginFromPrices(basePrice: number, finalPrice: number): number {
  if (basePrice < 0 || finalPrice < 0) {
    throw new Error("Motor de Preços: Os preços não podem ser negativos.");
  }
  
  // Lida com divisão por zero: se a base era gratuita e passou a ter preço
  if (basePrice === 0) {
    if (finalPrice > 0) return Infinity; // Teoricamente um lucro infinito
    return 0; // De zero a zero, a margem é 0
  }

  const baseCents = decimalToCents(basePrice);
  const finalCents = decimalToCents(finalPrice);

  const marginPercentage = ((finalCents / baseCents) - 1) * 100;
  
  // Arredondamento da margem para até 4 casas decimais para manter precisão de decimais,
  // ou 2 casas decimais para exibição padrão. Vamos usar 4 casas para evitar flutuações.
  return Math.round(marginPercentage * 10000) / 10000;
}

export interface QuoteItemCalculation {
  quantity: number;
  unitPrice: number; // Preço unitário decimal cobrado do cliente (já pode ter margem embutida)
}

/**
 * 3. Valida e totaliza os itens de uma cotação/pedido recalculando a soma exata por linha.
 * Cada linha multiplica `(cents * qtd)` e arredonda, espelhando a lógica de notas fiscais (NFe).
 * 
 * @param items Lista de itens contendo quantidade e valor unitário
 * @returns Total somado e seguro em decimal
 */
export function calculateQuoteTotal(items: QuoteItemCalculation[]): number {
  let totalCents = 0;

  for (const item of items) {
    if (item.quantity < 0 || item.unitPrice < 0) {
      throw new Error("Motor de Preços: Quantidade e preço unitário não podem ser negativos na linha do orçamento.");
    }
    
    // Tratamos apenas com centavos
    const unitPriceCents = decimalToCents(item.unitPrice);
    
    // Multiplicando e garantindo que eventuais dízimas de quantidades fracionadas sumam e virem centavos redondos
    const itemTotalCents = Math.round(unitPriceCents * item.quantity);
    
    totalCents += itemTotalCents;
  }

  return centsToDecimal(totalCents);
}

/**
 * 4. Tratamento rigoroso de discrepâncias validando se o somatório dos itens diverge do total exigido.
 * Fundamental para checar "custos ocultos", ou perdas de centavos em divisão de sub-totais.
 * 
 * @param items Os itens na cotação com valor e qtd
 * @param providedTotal O montante final fornecido (se vier do DB ou request)
 * @returns boolean informando se os valores fecham centavo por centavo
 */
export function validateQuoteTotal(items: QuoteItemCalculation[], providedTotal: number): boolean {
  if (providedTotal < 0) {
    throw new Error("Motor de Preços: O total fornecido a validar não pode ser negativo.");
  }

  const calculatedTotalCents = decimalToCents(calculateQuoteTotal(items));
  const providedTotalCents = decimalToCents(providedTotal);

  // Exige match exato
  return calculatedTotalCents === providedTotalCents;
}
