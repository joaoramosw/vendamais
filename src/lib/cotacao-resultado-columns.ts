/**
 * Colunas da tabela de comparação de cotações.
 *
 * Extraído da view pra ser compartilhado com a página de Ajustes
 * (`/empresario/ajustes`), que edita ordem e rótulos das mesmas colunas — a
 * definição precisa ser uma só, senão a página de ajustes lista colunas que
 * a tabela não tem (ou o contrário).
 *
 * A persistência continua em localStorage (mesma chave), via
 * `loadColumnOrder`/`saveColumnOrder` de `column-config-modal`.
 */

import type { ColumnDef } from '@/components/ui/column-config-modal';

export const RESULTADO_COLUMNS: ColumnDef[] = [
  { id: 'produto', label: 'Produto', fixed: true },
  { id: 'primeiro', label: '1º colocado' },
  { id: 'segundo', label: '2º colocado' },
  { id: 'terceiro', label: '3º colocado' },
  // Antes exibia o preço vencedor (redundante com a coluna "1º colocado",
  // que hoje mostra empresa + valor). Passou a ser o preço praticado na
  // loja (products.price_unit_store), que é a base do valor ideal de compra.
  { id: 'preco', label: 'Preço loja' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'sugestao', label: 'Sugestão' },
];

export const RESULTADO_DEFAULT_ORDER = RESULTADO_COLUMNS.map((c) => c.id);

export const RESULTADO_COL_STORAGE_KEY = 'vendamais_resultado_columns';
