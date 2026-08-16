-- ===========================================
-- ANTIGRAVITY — Supabase Migration Script
-- Run this in the Supabase SQL Editor
-- ===========================================

-- ===========================================
-- 1. PROFILES (estende auth.users)
-- ===========================================
CREATE TYPE user_tipo AS ENUM ('empresario', 'fornecedor');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  tipo user_tipo NOT NULL,
  telefone TEXT,
  empresa TEXT,
  cnpj TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para criar profile automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, tipo, empresa, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuário'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'tipo')::user_tipo, 'empresario'),
    NEW.raw_user_meta_data->>'empresa',
    NEW.raw_user_meta_data->>'telefone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================
-- 2. COTAÇÕES
-- ===========================================
CREATE TYPE cotacao_status AS ENUM ('aberta', 'em_andamento', 'encerrada');

CREATE TABLE cotacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status cotacao_status DEFAULT 'aberta',
  data_limite TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cotacoes_empresario ON cotacoes(empresario_id);
CREATE INDEX idx_cotacoes_status ON cotacoes(status);

-- ===========================================
-- 3. ITENS DA COTAÇÃO
-- ===========================================
CREATE TABLE cotacao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id UUID NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  nome_produto TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'un',
  quantidade NUMERIC NOT NULL CHECK (quantidade > 0),
  observacao TEXT
);

CREATE INDEX idx_cotacao_itens_cotacao ON cotacao_itens(cotacao_id);

-- ===========================================
-- 4. PROPOSTAS
-- ===========================================
CREATE TYPE proposta_status AS ENUM ('enviada', 'recebida', 'aceita', 'recusada');

CREATE TABLE propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id UUID NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status proposta_status DEFAULT 'enviada',
  valor_total NUMERIC,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cotacao_id, fornecedor_id)
);

CREATE INDEX idx_propostas_cotacao ON propostas(cotacao_id);
CREATE INDEX idx_propostas_fornecedor ON propostas(fornecedor_id);

-- ===========================================
-- 5. ITENS DA PROPOSTA
-- ===========================================
CREATE TABLE proposta_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  cotacao_item_id UUID NOT NULL REFERENCES cotacao_itens(id) ON DELETE CASCADE,
  preco_unitario NUMERIC NOT NULL CHECK (preco_unitario >= 0),
  quantidade_disponivel NUMERIC,
  observacao TEXT
);

CREATE INDEX idx_proposta_itens_proposta ON proposta_itens(proposta_id);

-- ===========================================
-- 6. ROW LEVEL SECURITY
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposta_itens ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Profiles visíveis para autenticados"
  ON profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Usuário edita próprio perfil"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- COTAÇÕES
CREATE POLICY "Empresário vê próprias cotações"
  ON cotacoes FOR SELECT TO authenticated
  USING (
    empresario_id = auth.uid()
    OR (
      (SELECT tipo FROM profiles WHERE id = auth.uid()) = 'fornecedor'
      AND status IN ('aberta', 'em_andamento')
    )
  );

CREATE POLICY "Empresário cria cotação"
  ON cotacoes FOR INSERT TO authenticated
  WITH CHECK (
    empresario_id = auth.uid()
    AND (SELECT tipo FROM profiles WHERE id = auth.uid()) = 'empresario'
  );

CREATE POLICY "Empresário atualiza própria cotação"
  ON cotacoes FOR UPDATE TO authenticated
  USING (empresario_id = auth.uid())
  WITH CHECK (empresario_id = auth.uid());

CREATE POLICY "Empresário deleta própria cotação"
  ON cotacoes FOR DELETE TO authenticated
  USING (empresario_id = auth.uid());

-- COTAÇÃO ITENS
CREATE POLICY "Itens visíveis se cotação visível"
  ON cotacao_itens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cotacoes
      WHERE cotacoes.id = cotacao_itens.cotacao_id
      AND (
        cotacoes.empresario_id = auth.uid()
        OR (
          (SELECT tipo FROM profiles WHERE id = auth.uid()) = 'fornecedor'
          AND cotacoes.status IN ('aberta', 'em_andamento')
        )
      )
    )
  );

CREATE POLICY "Empresário insere item na cotação"
  ON cotacao_itens FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cotacoes
      WHERE cotacoes.id = cotacao_itens.cotacao_id
      AND cotacoes.empresario_id = auth.uid()
    )
  );

CREATE POLICY "Empresário modifica item da cotação"
  ON cotacao_itens FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cotacoes
      WHERE cotacoes.id = cotacao_itens.cotacao_id
      AND cotacoes.empresario_id = auth.uid()
    )
  );

CREATE POLICY "Empresário deleta item da cotação"
  ON cotacao_itens FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cotacoes
      WHERE cotacoes.id = cotacao_itens.cotacao_id
      AND cotacoes.empresario_id = auth.uid()
    )
  );

-- PROPOSTAS
CREATE POLICY "Propostas visíveis para partes envolvidas"
  ON propostas FOR SELECT TO authenticated
  USING (
    fornecedor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM cotacoes
      WHERE cotacoes.id = propostas.cotacao_id
      AND cotacoes.empresario_id = auth.uid()
    )
  );

CREATE POLICY "Fornecedor cria proposta"
  ON propostas FOR INSERT TO authenticated
  WITH CHECK (
    fornecedor_id = auth.uid()
    AND (SELECT tipo FROM profiles WHERE id = auth.uid()) = 'fornecedor'
  );

CREATE POLICY "Fornecedor atualiza proposta"
  ON propostas FOR UPDATE TO authenticated
  USING (
    fornecedor_id = auth.uid() AND status = 'enviada'
  );

CREATE POLICY "Empresário gerencia status da proposta"
  ON propostas FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cotacoes
      WHERE cotacoes.id = propostas.cotacao_id
      AND cotacoes.empresario_id = auth.uid()
    )
  );

-- PROPOSTA ITENS
CREATE POLICY "Itens da proposta visíveis"
  ON proposta_itens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM propostas
      WHERE propostas.id = proposta_itens.proposta_id
      AND (
        propostas.fornecedor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM cotacoes
          WHERE cotacoes.id = propostas.cotacao_id
          AND cotacoes.empresario_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Fornecedor insere item na proposta"
  ON proposta_itens FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM propostas
      WHERE propostas.id = proposta_itens.proposta_id
      AND propostas.fornecedor_id = auth.uid()
    )
  );

CREATE POLICY "Fornecedor atualiza item da proposta"
  ON proposta_itens FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM propostas
      WHERE propostas.id = proposta_itens.proposta_id
      AND propostas.fornecedor_id = auth.uid()
    )
  );
