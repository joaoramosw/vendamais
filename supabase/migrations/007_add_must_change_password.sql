-- ============================================================
-- VENDAMAIS — 007: must_change_password flag
-- Suporta o fluxo de criação imediata de usuário com senha
-- provisória (gestão de usuários): força troca de senha no
-- primeiro login.
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
