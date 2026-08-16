-- =============================================================================
-- Migrations pendentes do fluxo de proposta — cole tudo no SQL Editor do
-- Supabase e rode de uma vez.
--
-- As duas são aditivas e idempotentes (IF NOT EXISTS): rodar de novo não faz
-- nada. Nenhuma mudança de código é necessária depois — o backend testa as
-- colunas em tempo de execução e passa a usá-las sozinho (re-teste a cada 60s,
-- sem reiniciar).
--
-- 020 — proposta_itens.product_id
--   Liga a oferta do fornecedor ao produto do catálogo. Sem ela, o gráfico de
--   histórico de preço da página do produto não enxerga as ofertas reais.
--   (O envio da proposta já funciona sem ela desde 15/08/2026.)
--
-- 023 — propostas.observacao
--   "Observações gerais" da proposta. Enquanto não roda, **o campo nem aparece**
--   na tela do fornecedor (/proposta/[id]) — o backend avisa a UI por
--   `observacao_geral_suportada: false` para não fingir que grava.
-- =============================================================================

-- ─── 020 ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.proposta_itens
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS proposta_itens_product_created_idx
  ON public.proposta_itens (product_id, created_at DESC);

-- Backfill do que já existe: casa a oferta com o item da cotação de origem
-- pelo nome do produto (única ponte disponível para linhas antigas).
UPDATE public.proposta_itens pi
SET product_id = ci.product_id
FROM public.propostas p
JOIN public.cotacao_itens ci ON ci.cotacao_id = p.cotacao_id
WHERE pi.proposta_id = p.id
  AND pi.product_id IS NULL
  AND ci.product_id IS NOT NULL
  AND lower(btrim(ci.nome_produto)) = lower(btrim(pi.produto_nome));

-- ─── 023 ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS observacao text;

-- ─── Conferência ─────────────────────────────────────────────────────────────
-- Deve devolver as duas linhas.
SELECT table_name, column_name
FROM information_schema.columns
WHERE (table_name = 'proposta_itens' AND column_name = 'product_id')
   OR (table_name = 'propostas' AND column_name = 'observacao');
