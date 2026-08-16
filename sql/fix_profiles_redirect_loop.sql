-- ============================================================
-- VENDAMAIS — FIX PROFILES SCHEMA & REDIRECT LOOP
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor)
-- ============================================================

-- 1. Recriação dos tipos ENUM (Fase 1 - Gestão de Usuários)
DO $$ BEGIN
    CREATE TYPE public.global_role AS ENUM ('super_admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('admin', 'moderador', 'fornecedor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Restauração das colunas vitais na tabela profiles
-- (A ausência dessas colunas causava as falhas no middleware e no layout,
-- gerando o loop infinito de redirecionamentos para o dashboard)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS global_role public.global_role DEFAULT 'user',
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS active_organization_id uuid REFERENCES public.organizations(id),
ADD COLUMN IF NOT EXISTS role public.user_role;

-- 3. Recuperação de perfis deletados
-- (Isso corrige o problema do seu usuário estar aparecendo como "Usuario".
-- Ele vai varrer os logins do Supabase Auth e recriar os perfis na tabela
-- resgatando o nome real e os dados originais que ficaram guardados nos metadados.)
INSERT INTO public.profiles (id, nome, email, tipo, empresa, telefone)
SELECT 
    id, 
    -- Resgata o nome real dos metadados originais da auth.users
    COALESCE(raw_user_meta_data->>'nome', split_part(email, '@', 1)),
    email,
    COALESCE((raw_user_meta_data->>'tipo')::public.user_tipo, 'empresario'::public.user_tipo),
    raw_user_meta_data->>'empresa',
    raw_user_meta_data->>'telefone'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 4. Opcional: Para garantir acesso total, vamos conceder super_admin ao seu e-mail
-- (Substitua joao@... pelo seu email real se precisar)
-- UPDATE public.profiles SET global_role = 'super_admin' WHERE email = 'joao@...';
