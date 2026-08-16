-- ============================================
-- QUOTATION ITEMS V2 MIGRATION
-- Enhances cotacao_itens with product fields
-- ============================================

-- 1. Add new columns to cotacao_itens
ALTER TABLE cotacao_itens
  ADD COLUMN IF NOT EXISTS codigo_barras text,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS estoque_atual numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_sugerida numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo_unidade text NOT NULL DEFAULT 'UN'
    CHECK (tipo_unidade IN ('UN', 'CX', 'DZ'));

-- 2. Migrate old 'unidade' values to tipo_unidade where possible
UPDATE cotacao_itens
SET tipo_unidade = CASE
  WHEN LOWER(unidade) IN ('cx', 'caixa') THEN 'CX'
  WHEN LOWER(unidade) IN ('dz', 'duzia', 'dúzia', 'dz.') THEN 'DZ'
  ELSE 'UN'
END
WHERE tipo_unidade = 'UN';

-- 3. Set quantidade_sugerida from existing quantidade
UPDATE cotacao_itens
SET quantidade_sugerida = quantidade
WHERE quantidade_sugerida = 0;

-- 4. Indexes for new searchable columns
CREATE INDEX IF NOT EXISTS idx_cotacao_itens_barcode ON cotacao_itens(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_cotacao_itens_product_id ON cotacao_itens(product_id);
CREATE INDEX IF NOT EXISTS idx_cotacao_itens_categoria ON cotacao_itens(categoria);

-- 5. Done — no RLS changes needed (existing policies cover the table)
-- Note: Sensitive fields (estoque_atual, quantidade_sugerida) are filtered
-- at the query level in the application (not shown to suppliers).
