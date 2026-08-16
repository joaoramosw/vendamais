-- =============================================================================
-- 010: Segmentos de fornecedor
--
-- Classificação de fornecedores (users com role 'supplier') em segmentos
-- (ex: "Cosméticos"), pra permitir convidar em massa por grupo na criação
-- de uma cotação. Um segmento por fornecedor (não N:N como categories/
-- product_categories).
-- =============================================================================

CREATE TABLE IF NOT EXISTS segmentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  cor text DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS segmento_id uuid REFERENCES segmentos(id);

-- Segmento default
INSERT INTO segmentos (nome, slug) VALUES ('Cosméticos', 'cosmeticos')
ON CONFLICT (slug) DO NOTHING;

-- Backfill: fornecedores existentes sem segmento caem no default
UPDATE users SET segmento_id = (SELECT id FROM segmentos WHERE slug = 'cosmeticos')
WHERE segmento_id IS NULL
  AND role_id = (SELECT id FROM roles WHERE key = 'supplier');

ALTER TABLE segmentos ENABLE ROW LEVEL SECURITY;

-- RLS totalmente aberta, mesmo padrão de categories.sql (mutações reais
-- passam pelo service role nas Server Actions/backend, RLS aqui é formalidade).
DROP POLICY IF EXISTS "Segmentos select" ON segmentos;
CREATE POLICY "Segmentos select" ON segmentos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Segmentos insert" ON segmentos;
CREATE POLICY "Segmentos insert" ON segmentos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Segmentos update" ON segmentos;
CREATE POLICY "Segmentos update" ON segmentos FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Segmentos delete" ON segmentos;
CREATE POLICY "Segmentos delete" ON segmentos FOR DELETE USING (true);
