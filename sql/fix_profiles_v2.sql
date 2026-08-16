-- ============================================================
-- VENDAMAIS — FIX PROFILES SCHEMA (V2)
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor)
-- ============================================================

-- 1. Recriar tipos ENUM (ignorados com sucesso se já existirem)
DO $$ BEGIN
    CREATE TYPE public.global_role AS ENUM ('super_admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('admin', 'moderador', 'fornecedor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.user_tipo AS ENUM ('empresario', 'fornecedor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 2. Restauração de TODAS as colunas principais na tabela profiles
-- (O script anterior, que possuía o 'DROP TABLE profiles',
-- excluiu a tabela inteira e a recriou APENAS herdando configurações 
-- do auth.users. Ele deletou colunas vitais pro App como "nome" e "tipo")
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS nome text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS tipo public.user_tipo,
ADD COLUMN IF NOT EXISTS telefone text,
ADD COLUMN IF NOT EXISTS empresa text,
ADD COLUMN IF NOT EXISTS cnpj text,
ADD COLUMN IF NOT EXISTS global_role public.global_role DEFAULT 'user',
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS active_organization_id uuid REFERENCES public.organizations(id),
ADD COLUMN IF NOT EXISTS role public.user_role;


-- 3. Recuperação de perfis deletados COM SQL DINÂMICO
-- (Usar EXECUTE previne o erro 42703 do painel do Supabase, 
-- pois avalia a query após garantir que o ALTER TABLE já foi rodado)
DO $$ 
BEGIN
  EXECUTE '
  INSERT INTO public.profiles (id, nome, email, tipo, empresa, telefone)
  SELECT 
      id, 
      COALESCE(raw_user_meta_data->>''nome'', split_part(email, ''@'', 1)),
      email,
      COALESCE((raw_user_meta_data->>''tipo'')::public.user_tipo, ''empresario''::public.user_tipo),
      raw_user_meta_data->>''empresa'',
      raw_user_meta_data->>''telefone''
  FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.profiles)
  ON CONFLICT (id) DO NOTHING;
  ';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro ao inserir perfis: %', SQLERRM;
END $$;


-- 4. Re-sincronizar dados de usuários antigos que perderam o "nome"
-- (Se a tabela foi recriada só com id pelo outro script)
DO $$
BEGIN
  EXECUTE '
  UPDATE public.profiles p
  SET 
    nome = COALESCE(p.nome, u.raw_user_meta_data->>''nome'', split_part(u.email, ''@'', 1)),
    email = COALESCE(p.email, u.email),
    tipo = COALESCE(p.tipo, (u.raw_user_meta_data->>''tipo'')::public.user_tipo, ''empresario''::public.user_tipo),
    empresa = COALESCE(p.empresa, u.raw_user_meta_data->>''empresa''),
    telefone = COALESCE(p.telefone, u.raw_user_meta_data->>''telefone'')
  FROM auth.users u
  WHERE p.id = u.id AND (p.nome IS NULL OR p.email IS NULL OR p.tipo IS NULL);
  ';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro ao atualizar dados: %', SQLERRM;
END $$;
