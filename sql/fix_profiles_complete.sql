-- ============================================================
-- VENDAMAIS — FIX PROFILES COMPLETE (CONSOLIDATED)
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor)
-- Idempotente: seguro para rodar mais de uma vez.
-- ============================================================

-- 1. Tipos ENUM
DO $$ BEGIN
    CREATE TYPE public.global_role AS ENUM ('super_admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.role_type AS ENUM ('admin', 'moderador', 'fornecedor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.user_tipo AS ENUM ('empresario', 'fornecedor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 2. Garantir que TODAS as colunas vitais existam
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
ADD COLUMN IF NOT EXISTS role public.role_type;


-- 3. Trigger para auto-criar profile quando um novo usuário é criado no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, tipo, role, empresa, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'tipo')::public.user_tipo, 'empresario'::public.user_tipo),
    CASE
      WHEN lower(coalesce(NEW.raw_user_meta_data->>'tipo', 'empresario')) = 'fornecedor'
        THEN 'fornecedor'::public.role_type
      ELSE 'admin'::public.role_type
    END,
    NEW.raw_user_meta_data->>'empresa',
    NEW.raw_user_meta_data->>'telefone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Recriar o trigger (idempotente)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 4. Sincronizar perfis ausentes (usuários que já existem no auth.users)
DO $$ 
BEGIN
  EXECUTE '
  INSERT INTO public.profiles (id, nome, email, tipo, role, empresa, telefone)
  SELECT 
      id, 
      COALESCE(raw_user_meta_data->>''nome'', split_part(email, ''@'', 1)),
      email,
      COALESCE((raw_user_meta_data->>''tipo'')::public.user_tipo, ''empresario''::public.user_tipo),
      CASE
        WHEN lower(coalesce(raw_user_meta_data->>''tipo'', ''empresario'')) = ''fornecedor''
          THEN ''fornecedor''::public.role_type
        ELSE ''admin''::public.role_type
      END,
      raw_user_meta_data->>''empresa'',
      raw_user_meta_data->>''telefone''
  FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.profiles)
  ON CONFLICT (id) DO NOTHING;
  ';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro ao inserir perfis: %', SQLERRM;
END $$;


-- 5. Preencher campos NULL em perfis existentes com dados do auth.users
DO $$
BEGIN
  EXECUTE '
  UPDATE public.profiles p
  SET 
    nome = COALESCE(p.nome, u.raw_user_meta_data->>''nome'', split_part(u.email, ''@'', 1)),
    email = COALESCE(p.email, u.email),
    tipo = COALESCE(p.tipo, (u.raw_user_meta_data->>''tipo'')::public.user_tipo, ''empresario''::public.user_tipo),
    role = COALESCE(
      p.role,
      CASE
        WHEN lower(coalesce(u.raw_user_meta_data->>''tipo'', ''empresario'')) = ''fornecedor''
          THEN ''fornecedor''::public.role_type
        ELSE ''admin''::public.role_type
      END
    ),
    empresa = COALESCE(p.empresa, u.raw_user_meta_data->>''empresa''),
    telefone = COALESCE(p.telefone, u.raw_user_meta_data->>''telefone'')
  FROM auth.users u
  WHERE p.id = u.id AND (p.nome IS NULL OR p.email IS NULL OR p.tipo IS NULL OR p.role IS NULL);
  ';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro ao atualizar dados: %', SQLERRM;
END $$;


-- 6. Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Profiles visíveis para autenticados" ON public.profiles;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Profiles visíveis para autenticados"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

DO $$ BEGIN
    DROP POLICY IF EXISTS "Usuário edita próprio perfil" ON public.profiles;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Usuário edita próprio perfil"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT policy para permitir que o app crie perfis via ensureProfile
DO $$ BEGIN
    DROP POLICY IF EXISTS "Usuário cria próprio perfil" ON public.profiles;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Usuário cria próprio perfil"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());


-- 7. Grants
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;


-- ============================================================
-- DONE ✅
-- Resumo:
--   ✓ ENUMs criados/verificados
--   ✓ Colunas vitais garantidas na tabela profiles
--   ✓ Trigger handle_new_user criado (auto-cria profile no signup)
--   ✓ Perfis ausentes sincronizados do auth.users
--   ✓ Campos NULL preenchidos com metadados do auth
--   ✓ RLS com políticas de SELECT, UPDATE e INSERT
-- ============================================================
