-- =============================================================================
-- 020: proposta_itens.product_id — liga a oferta real do fluxo de cotação ao
--      produto do catálogo.
--
-- Hoje `proposta_itens` só guarda `produto_nome` (texto livre, copiado do item
-- da cotação no momento do envio). Isso é proposital para o histórico não
-- mudar se o produto for renomeado depois — mas deixa a oferta órfã do
-- catálogo, e o gráfico da página do produto não consegue enxergar as ofertas
-- que realmente vieram de fornecedores.
--
-- `cotacao_itens.product_id` já existe e está disponível no momento do envio
-- (ver backend/src/propostas/propostas.service.ts#enviarProposta), então
-- basta carregá-lo junto. A coluna é NULLABLE: item de cotação digitado à mão,
-- sem produto do catálogo por trás, continua válido.
--
-- Aditiva. Enquanto não rodar, `getHistoricoProduto` simplesmente não consulta
-- esta fonte e usa só `product_quotes`.
-- =============================================================================

ALTER TABLE public.proposta_itens
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS proposta_itens_product_created_idx
  ON public.proposta_itens (product_id, created_at DESC);

-- Backfill do que já existe: casa a oferta com o item da cotação de origem
-- pelo nome do produto. É a única ponte disponível para linhas antigas —
-- daqui pra frente o valor vem preenchido no insert, sem depender de nome.
UPDATE public.proposta_itens pi
SET product_id = ci.product_id
FROM public.propostas p
JOIN public.cotacao_itens ci ON ci.cotacao_id = p.cotacao_id
WHERE pi.proposta_id = p.id
  AND pi.product_id IS NULL
  AND ci.product_id IS NOT NULL
  AND lower(btrim(ci.nome_produto)) = lower(btrim(pi.produto_nome));
