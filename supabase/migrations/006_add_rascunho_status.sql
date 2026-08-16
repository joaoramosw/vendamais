-- ============================================
-- Migration 006: Add 'rascunho' to cotacao_status enum
-- ============================================
-- ⚠️ IMPORTANTE: Execute em TRÊS etapas separadas no Supabase SQL Editor.

-- ═══════════════════════════════════════════
-- ETAPA 1: Execute isto PRIMEIRO, sozinho
-- ═══════════════════════════════════════════
ALTER TYPE cotacao_status ADD VALUE IF NOT EXISTS 'rascunho' BEFORE 'aberta';

-- ═══════════════════════════════════════════
-- ETAPA 2: Execute isto DEPOIS, em uma segunda execução
-- ═══════════════════════════════════════════
-- ALTER TABLE cotacoes ALTER COLUMN status SET DEFAULT 'rascunho';

-- ═══════════════════════════════════════════
-- ETAPA 3: Adicionar coluna data_limite (se não existir)
-- ═══════════════════════════════════════════
-- ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS data_limite TIMESTAMPTZ;
