-- =============================================================================
-- 018: margem_config — margem padrão, tolerância e método de cálculo do
--      "valor ideal de compra" exibido na tabela de comparação de cotações.
--
-- Mora em `site_settings` (014) em vez de tabela nova: é a mesma natureza de
-- dado (configuração do painel) e herda o desenho org-ready dali —
-- organization_id sempre NULL hoje (linha "global" única), com espaço pra
-- linhas por organização no futuro sem migrar dado existente.
--
-- Aditivo (ADD COLUMN IF NOT EXISTS + DEFAULT), nunca recriando a tabela —
-- ver gotcha #12 do CLAUDE.md.
--
-- Forma do JSON (ver src/lib/margem.ts):
--   { "margem_percent": 28.5, "tolerancia_percent": 0.5, "metodo": "markup" }
-- `metodo`: 'markup'   -> valor_ideal = preco_loja / (1 + margem)   [padrão]
--           'desconto' -> valor_ideal = preco_loja * (1 - margem)
--
-- Escrita só via service role (src/actions/margem.ts, requireAdminWithClient),
-- igual ao restante de site_settings — por isso não há policy nova aqui.
-- =============================================================================

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS margem_config jsonb NOT NULL
  DEFAULT '{"margem_percent": 28.5, "tolerancia_percent": 0.5, "metodo": "markup"}'::jsonb;

-- Linhas criadas antes desta migration ficam com o default acima; este UPDATE
-- só cobre o caso de uma linha ter sido gravada com '{}' explicitamente.
UPDATE site_settings
SET margem_config = '{"margem_percent": 28.5, "tolerancia_percent": 0.5, "metodo": "markup"}'::jsonb
WHERE margem_config IS NULL OR margem_config = '{}'::jsonb;
