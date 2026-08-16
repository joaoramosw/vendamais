-- ============================================================
-- VENDAMAIS — FIX PROFILES RLS (Row Level Security)
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor)
-- ============================================================

-- Quando a tabela profiles foi recriada (ou alterada via DROP),
-- as políticas de segurança (RLS) que permitem ao usuário
-- ler seu próprio perfil foram perdidas. 
-- Isso faz com que o banco retorne 0 linhas, causando o erro nulo no Layout.

-- 1. Garantir que o RLS está ativo
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Recriar a política de leitura (Permitir que usuários logados vejam os perfis)
-- Usamos DROP POLICY IF EXISTS para evitar erros se já existir
DO $$ BEGIN
    DROP POLICY IF EXISTS "Profiles visíveis para autenticados" ON public.profiles;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Profiles visíveis para autenticados"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- 3. Recriar a política de edição (Permitir que o usuário edite o próprio perfil)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Usuário edita próprio perfil" ON public.profiles;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Usuário edita próprio perfil"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
