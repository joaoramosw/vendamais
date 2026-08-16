import { z } from "zod";

/**
 * Validação dos payloads de proposta — espelho dos DTOs class-validator do
 * backend NestJS (ver nota em src/server/cotacoes/dto.ts sobre `strictObject`
 * ≙ `forbidNonWhitelisted`).
 */

export const propostaItemSchema = z.strictObject({
  cotacao_item_id: z.uuid(),
  preco_unitario: z.number().min(0),
  observacao: z.string().optional(),
  /** false = fornecedor marcou explicitamente que não tem o item (preço
   * é gravado como 0 independente do que vier aqui). Default true. */
  disponivel: z.boolean().optional(),
});

export const enviarPropostaSchema = z.strictObject({
  token_acesso: z.string().min(1),
  prazo_entrega: z.string().optional(),
  /** "Observações gerais" — vale pra proposta inteira (≠ observação por item).
   * Só é persistida depois da migration 023; antes disso o servidor ignora o
   * campo em vez de recusar o envio. */
  observacao: z.string().optional(),
  whatsapp: z.string().optional(),
  nome_empresa: z.string().optional(),
  itens: z.array(propostaItemSchema),
});

export type EnviarPropostaInput = z.infer<typeof enviarPropostaSchema>;

export const gerenciarPropostaSchema = z.strictObject({
  status: z.enum(["aceita", "recusada"]),
});
