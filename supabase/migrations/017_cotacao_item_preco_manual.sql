-- =============================================================================
-- 017: Preço unitário manual (override) por item da cotação
--
-- Permite ao empresário registrar/travar um preço unitário final para um
-- item, sobrepondo o menor preço calculado automaticamente pelo ranking de
-- propostas (backend/src/propostas/ranking-por-item.util.ts) — útil quando
-- o preço foi renegociado fora da plataforma ou quando nenhum fornecedor
-- cotou o item. Aditivo, nullable/default false, não afeta linhas existentes.
-- =============================================================================

ALTER TABLE cotacao_itens ADD COLUMN IF NOT EXISTS preco_unitario_manual numeric(12,2);
ALTER TABLE cotacao_itens ADD COLUMN IF NOT EXISTS preco_manual boolean NOT NULL DEFAULT false;
