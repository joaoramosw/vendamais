-- ============================================================
-- VENDAMAIS — SQL COMPLETO PARA PARTE 3
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor)
-- ============================================================
-- IMPORTANTE: Execute todo o script de uma vez.
-- Todas as alterações usam IF NOT EXISTS / IF EXISTS para
-- evitar erros caso alguma parte já tenha sido aplicada.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. TABELAS BASE (verificar se existem — estas JÁ devem existir)
-- ────────────────────────────────────────────────────────────

-- profiles (já existe)
-- organizations (já existe)
-- memberships (já existe)
-- invitations (já existe)
-- audit_log (já existe)
-- cotacoes (já existe)
-- cotacao_itens (já existe)
-- propostas (já existe)
-- proposta_itens (já existe)
-- products (já existe)
-- product_quotes (já existe)
-- categories (já existe)
-- product_categories (já existe)


-- ────────────────────────────────────────────────────────────
-- 2. ALTER TABLE — Novas colunas em tabelas existentes
-- ────────────────────────────────────────────────────────────

-- 2.1 Fabricante/distribuidora no products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS fabricante text DEFAULT NULL;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS distribuidora text DEFAULT NULL;

COMMENT ON COLUMN public.products.fabricante IS 'Nome do fabricante do produto';
COMMENT ON COLUMN public.products.distribuidora IS 'Nome da distribuidora do produto';

-- 2.2 Organização do produto (organization_id)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS organization_id uuid DEFAULT NULL
REFERENCES public.organizations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.products.organization_id IS 'Organização dona do produto';

-- 2.3 Tags no produto (campo texto simples para MVP)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

COMMENT ON COLUMN public.products.tags IS 'Tags de classificação (array de strings)';

-- 2.4 Rotatividade (curva ABC) no produto
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS curva_abc char(1) DEFAULT NULL
CHECK (curva_abc IN ('A', 'B', 'C'));

COMMENT ON COLUMN public.products.curva_abc IS 'Classificação de rotatividade: A (alta), B (média), C (baixa)';


-- ────────────────────────────────────────────────────────────
-- 3. NOVAS TABELAS — Catálogo hierárquico
-- ────────────────────────────────────────────────────────────

-- 3.1 Sessões (nível mais alto do catálogo)
CREATE TABLE IF NOT EXISTS public.sessoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    slug text NOT NULL UNIQUE,
    descricao text,
    cor text DEFAULT '#6366f1',
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    ordem int DEFAULT 0,
    ativo boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.sessoes IS 'Sessões do catálogo (nível 1)';

-- 3.2 Subseções (nível 2, abaixo de sessão)
CREATE TABLE IF NOT EXISTS public.subsecoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sessao_id uuid NOT NULL REFERENCES public.sessoes(id) ON DELETE CASCADE,
    nome text NOT NULL,
    slug text NOT NULL,
    descricao text,
    ordem int DEFAULT 0,
    ativo boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    UNIQUE(sessao_id, slug)
);

COMMENT ON TABLE public.subsecoes IS 'Subseções do catálogo (nível 2)';

-- 3.3 Relacionamento produto ↔ subseção
CREATE TABLE IF NOT EXISTS public.product_subsecoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    subsecao_id uuid NOT NULL REFERENCES public.subsecoes(id) ON DELETE CASCADE,
    UNIQUE(product_id, subsecao_id)
);

COMMENT ON TABLE public.product_subsecoes IS 'Relacionamento N:N entre produto e subseção';


-- ────────────────────────────────────────────────────────────
-- 4. NOVA TABELA — Modelo comercial / Planos
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.planos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    descricao text,
    preco_mensal numeric(10,2) DEFAULT 0,
    -- Limites
    max_cotacoes_mes int DEFAULT NULL,          -- NULL = ilimitado
    max_produtos int DEFAULT NULL,               -- NULL = ilimitado
    max_fornecedores int DEFAULT NULL,           -- NULL = ilimitado
    max_membros int DEFAULT NULL,                -- NULL = ilimitado
    -- Features
    tem_ranking boolean DEFAULT false,
    tem_exportacao boolean DEFAULT false,
    tem_historico boolean DEFAULT false,
    tem_whatsapp boolean DEFAULT false,
    tem_margem boolean DEFAULT false,
    -- Metadata
    ativo boolean DEFAULT true,
    ordem int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.planos IS 'Planos comerciais (beta, fundador, pro, etc.)';

-- Vincular organização ao plano
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS plano_id uuid DEFAULT NULL
REFERENCES public.planos(id) ON DELETE SET NULL;

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS plano_inicio timestamptz DEFAULT NULL;

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS plano_fim timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.organizations.plano_id IS 'Plano ativo da organização';
COMMENT ON COLUMN public.organizations.plano_inicio IS 'Data de início do plano';
COMMENT ON COLUMN public.organizations.plano_fim IS 'Data de vencimento do plano (NULL = sem expiração)';


-- ────────────────────────────────────────────────────────────
-- 5. INSERIR PLANOS PADRÃO
-- ────────────────────────────────────────────────────────────

INSERT INTO public.planos (nome, slug, descricao, preco_mensal, max_cotacoes_mes, max_produtos, max_fornecedores, max_membros, tem_ranking, tem_exportacao, tem_historico, tem_whatsapp, tem_margem, ordem)
VALUES
    ('Beta', 'beta', 'Acesso gratuito durante o período beta', 0, 5, 50, 10, 3, true, false, false, false, false, 1),
    ('Fundador', 'fundador', 'Para os primeiros adotantes — acesso vitalício com desconto', 49.90, 20, 200, 50, 10, true, true, true, true, true, 2),
    ('Profissional', 'pro', 'Para empresas em crescimento', 99.90, NULL, NULL, NULL, 25, true, true, true, true, true, 3),
    ('Enterprise', 'enterprise', 'Personalizado para grandes operações', 0, NULL, NULL, NULL, NULL, true, true, true, true, true, 4)
ON CONFLICT (slug) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 6. NOVA TABELA — Ranking agregado (cache materializado)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supplier_rankings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fornecedor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_score int DEFAULT 0,
    avg_position numeric(4,2) DEFAULT 0,
    wins int DEFAULT 0,
    total_items int DEFAULT 0,
    cotacoes_participadas int DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(empresario_id, fornecedor_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_rankings_empresario
ON public.supplier_rankings(empresario_id);

CREATE INDEX IF NOT EXISTS idx_supplier_rankings_score
ON public.supplier_rankings(empresario_id, total_score DESC);

COMMENT ON TABLE public.supplier_rankings IS 'Cache materializado do ranking de fornecedores (atualizado por trigger ou cron)';


-- ────────────────────────────────────────────────────────────
-- 7. ÍNDICES DE PERFORMANCE
-- ────────────────────────────────────────────────────────────

-- Cotações por empresário (para ranking e listagem)
CREATE INDEX IF NOT EXISTS idx_cotacoes_empresario_created
ON public.cotacoes(empresario_id, created_at DESC);

-- Propostas por cotação (join frequente)
CREATE INDEX IF NOT EXISTS idx_propostas_cotacao
ON public.propostas(cotacao_id);

-- Propostas por fornecedor (para ranking)
CREATE INDEX IF NOT EXISTS idx_propostas_fornecedor
ON public.propostas(fornecedor_id);

-- Itens por cotação (join frequente)
CREATE INDEX IF NOT EXISTS idx_cotacao_itens_cotacao
ON public.cotacao_itens(cotacao_id);

-- Itens de proposta por proposta (join frequente)
CREATE INDEX IF NOT EXISTS idx_proposta_itens_proposta
ON public.proposta_itens(proposta_id);

-- Itens de proposta por cotacao_item (para ranking por item)
CREATE INDEX IF NOT EXISTS idx_proposta_itens_cotacao_item
ON public.proposta_itens(cotacao_item_id);

-- Products por barcode (busca rápida)
CREATE INDEX IF NOT EXISTS idx_products_barcode
ON public.products(barcode) WHERE barcode IS NOT NULL;

-- Products por organização
CREATE INDEX IF NOT EXISTS idx_products_organization
ON public.products(organization_id) WHERE organization_id IS NOT NULL;

-- Products por fabricante
CREATE INDEX IF NOT EXISTS idx_products_fabricante
ON public.products(fabricante) WHERE fabricante IS NOT NULL;

-- Sessões por organização
CREATE INDEX IF NOT EXISTS idx_sessoes_organization
ON public.sessoes(organization_id);

-- Subseções por sessão
CREATE INDEX IF NOT EXISTS idx_subsecoes_sessao
ON public.subsecoes(sessao_id);

-- Memberships por user
CREATE INDEX IF NOT EXISTS idx_memberships_user
ON public.memberships(user_id);

-- Memberships por organização
CREATE INDEX IF NOT EXISTS idx_memberships_organization
ON public.memberships(organization_id);


-- ────────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

-- 8.1 Sessões — visíveis pela organização do usuário
ALTER TABLE public.sessoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "sessoes_select_own_org" ON public.sessoes
    FOR SELECT USING (
        organization_id IS NULL
        OR organization_id IN (
            SELECT organization_id FROM public.memberships
            WHERE user_id = auth.uid() AND is_active = true
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "sessoes_insert_own_org" ON public.sessoes
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.memberships
            WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "sessoes_update_own_org" ON public.sessoes
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM public.memberships
            WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "sessoes_delete_own_org" ON public.sessoes
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id FROM public.memberships
            WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8.2 Subseções — herdam permissão da sessão
ALTER TABLE public.subsecoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "subsecoes_select_via_sessao" ON public.subsecoes
    FOR SELECT USING (
        sessao_id IN (SELECT id FROM public.sessoes)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "subsecoes_manage_via_sessao" ON public.subsecoes
    FOR ALL USING (
        sessao_id IN (
            SELECT s.id FROM public.sessoes s
            JOIN public.memberships m ON m.organization_id = s.organization_id
            WHERE m.user_id = auth.uid() AND m.is_active = true AND m.role IN ('owner', 'admin')
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8.3 Product subseções
ALTER TABLE public.product_subsecoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "product_subsecoes_select" ON public.product_subsecoes
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "product_subsecoes_manage" ON public.product_subsecoes
    FOR ALL USING (
        product_id IN (
            SELECT id FROM public.products WHERE created_by = auth.uid()
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8.4 Planos — leitura pública
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "planos_select_all" ON public.planos
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8.5 Supplier rankings — visíveis pelo empresário
ALTER TABLE public.supplier_rankings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "supplier_rankings_select_own" ON public.supplier_rankings
    FOR SELECT USING (empresario_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────
-- 9. GRANTS (acesso para authenticated users)
-- ────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subsecoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_subsecoes TO authenticated;
GRANT SELECT ON public.planos TO authenticated;
GRANT SELECT ON public.supplier_rankings TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 10. DONE ✅
-- ────────────────────────────────────────────────────────────
-- Resumo do que foi criado/alterado:
--
-- ALTER TABLE products:
--   + fabricante (text)
--   + distribuidora (text)
--   + organization_id (uuid FK)
--   + tags (text[])
--   + curva_abc (char A/B/C)
--
-- ALTER TABLE organizations:
--   + plano_id (uuid FK)
--   + plano_inicio (timestamptz)
--   + plano_fim (timestamptz)
--
-- NEW TABLE sessoes (catálogo nível 1)
-- NEW TABLE subsecoes (catálogo nível 2)
-- NEW TABLE product_subsecoes (N:N produto ↔ subseção)
-- NEW TABLE planos (modelo comercial)
-- NEW TABLE supplier_rankings (cache de ranking)
--
-- + 15 índices de performance
-- + RLS policies para todas as novas tabelas
-- + 4 planos padrão inseridos (beta, fundador, pro, enterprise)
-- ============================================================
