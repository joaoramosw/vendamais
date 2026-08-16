import { z } from "zod";
import type { CotacaoStatus } from "./cotacoes.types";

/**
 * Validação dos payloads de /api/cotacoes/** — espelho dos DTOs
 * class-validator do backend NestJS que este módulo substitui.
 *
 * Todos os schemas de body são **estritos** (`strictObject`): o ValidationPipe
 * do Nest rodava com `forbidNonWhitelisted: true`, então campo desconhecido
 * era rejeitado — aceitar em silêncio agora seria afrouxar o contrato e abrir
 * espaço pra mass assignment.
 */

export const createCotacaoItemSchema = z.strictObject({
  nome_produto: z.string().min(1),
  unidade: z.string().min(1),
  quantidade: z.number().positive(),
  observacao: z.string().optional(),
  codigo_barras: z.string().optional(),
  categoria: z.string().optional(),
  product_id: z.uuid().optional(),
  descricao: z.string().optional(),
  estoque_atual: z.number().optional(),
  quantidade_sugerida: z.number().optional(),
  tipo_unidade: z.string().min(1),
});

export const createCotacaoSchema = z.strictObject({
  titulo: z.string().min(1),
  data_limite: z.string().optional(),
  itens: z.array(createCotacaoItemSchema),
});

export type CreateCotacaoInput = z.infer<typeof createCotacaoSchema>;

// 'aberta' entra como alvo por causa do par Pausar/Retomar da tela de
// gerenciamento (ver ALLOWED_TRANSITIONS em cotacoes.service.ts); publicar
// rascunho continua tendo rota própria (POST /api/cotacoes/[id]/publicar).
const TARGET_STATUSES = ["aberta", "fechada", "cancelada"] as const satisfies readonly CotacaoStatus[];

export const updateStatusSchema = z.strictObject({
  status: z.enum(TARGET_STATUSES),
});

export const updateCotacaoItemSchema = z.strictObject({
  quantidade_sugerida: z.number().min(0).optional(),
  preco_unitario_manual: z.number().min(0.01).optional(),
  // Flag separada porque "não mexer" e "limpar" precisam ser distinguíveis —
  // mesma decisão do DTO original.
  resetar_preco_manual: z.boolean().optional(),
});

export type UpdateCotacaoItemInput = z.infer<typeof updateCotacaoItemSchema>;

/** email_contato e whatsapp são ambos opcionais no schema — o service exige
 * que pelo menos um dos dois esteja presente (mensagem de erro mais clara
 * do que uma regra de validação cruzada aqui). */
export const convidarFornecedorSchema = z.strictObject({
  email_contato: z.email().optional(),
  whatsapp: z.string().optional(),
  nome_empresa: z.string().optional(),
});

export const convidarUsuariosSchema = z.strictObject({
  user_ids: z.array(z.uuid()).nonempty(),
});

/** Criação e renomeação compartilham a mesma forma (só o nome muda). */
export const grupoNomeSchema = z.strictObject({
  nome: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .min(1, "Dê um nome ao grupo.")
        .max(60, "O nome do grupo deve ter no máximo 60 caracteres."),
    ),
});

/**
 * Move um lote de cotações para um grupo. `grupo_id: null` (ou ausente) tira
 * as cotações de qualquer grupo — é a ação "Remover do grupo" da UI, e não
 * um payload inválido.
 */
export const atribuirGrupoSchema = z.strictObject({
  cotacao_ids: z.array(z.uuid()).nonempty(),
  grupo_id: z.uuid().nullish(),
});

export const EXPORT_FORMATOS = ["xlsx", "pdf"] as const;
export type ExportFormato = (typeof EXPORT_FORMATOS)[number];

export interface ExportCotacaoQuery {
  formato: ExportFormato;
  incluir_internos: boolean;
}

/** Query string do export — validação manual (query params chegam como
 * string; o DTO original usava @Transform pro booleano, com default true). */
export function parseExportQuery(searchParams: URLSearchParams): ExportCotacaoQuery {
  const formato = z.enum(EXPORT_FORMATOS).parse(searchParams.get("formato"));
  const incluirRaw = searchParams.get("incluir_internos");
  return {
    formato,
    incluir_internos: incluirRaw === null ? true : incluirRaw === "true",
  };
}
