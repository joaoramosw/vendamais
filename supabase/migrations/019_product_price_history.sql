-- =============================================================================
-- 019: product_price_history — série temporal do preço de loja do produto.
--
-- Por que existe: `products.price_unit_store` guarda só o valor ATUAL, e
-- `updated_at` não diz qual era o preço antes. Sem esta tabela, o gráfico de
-- evolução da página do produto só poderia desenhar uma reta no valor de hoje,
-- ou seja, dado inventado. `audit_log` também não serve — registra a ação, não
-- o valor.
--
-- Aditiva e desacoplada: uma tabela nova, sem tocar em `products` (ver gotcha
-- #12 do CLAUDE.md). Enquanto esta migration não roda, `getHistoricoProduto`
-- degrada sozinho para "sem histórico de preço de loja" — nada quebra.
--
-- O snapshot é gravado por `updateProduct`/`createProduct` (src/actions/
-- products.ts), sempre via service role, e SÓ quando o preço realmente muda —
-- salvar o produto sem mexer no preço não gera linha nova.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.product_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_unit_store numeric NOT NULL,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A consulta do gráfico é sempre "por produto, num intervalo, em ordem
-- cronológica" — este índice cobre exatamente isso.
CREATE INDEX IF NOT EXISTS product_price_history_product_created_idx
  ON public.product_price_history (product_id, created_at DESC);

ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

-- Sem policy de propósito: leitura e escrita passam pelo client admin nas
-- Server Actions (mesma decisão de `products` — ver gotcha #21 do CLAUDE.md,
-- a RLS legada baseada em `profiles` descartava escrita em silêncio).

-- Backfill: uma linha por produto com o preço atual, para o gráfico ter um
-- ponto de partida em vez de nascer vazio. `created_at` usa o `updated_at` do
-- produto (ou `created_at`), que é a melhor aproximação disponível de quando
-- aquele preço passou a valer.
INSERT INTO public.product_price_history (product_id, price_unit_store, created_at)
SELECT p.id, p.price_unit_store, COALESCE(p.updated_at, p.created_at)
FROM public.products p
WHERE p.deleted_at IS NULL
  AND p.price_unit_store IS NOT NULL
  AND p.price_unit_store > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.product_price_history h WHERE h.product_id = p.id
  );
