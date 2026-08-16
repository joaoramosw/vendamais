-- ============================================================
-- VENDAMAIS — FIX: relacionamento cotacao_itens -> cotacoes
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor)
-- ============================================================
--
-- Diagnóstico (16/07/2026): o PostgREST não reconhece nenhum
-- relacionamento entre `cotacoes` e `cotacao_itens` em nenhuma direção
-- ("Could not find a relationship between 'cotacoes' and 'cotacao_itens'
-- in the schema cache"). Isso quebra toda query que tenta trazer os itens
-- junto da cotação via embed (`.select('*, cotacao_itens (*)')`), usada em
-- "Minhas Cotações", detalhe da cotação, etc.
--
-- Isto é idempotente: se a constraint já existir, o bloco é ignorado.

DO $$ BEGIN
  ALTER TABLE public.cotacao_itens
    ADD CONSTRAINT cotacao_itens_cotacao_id_fkey
    FOREIGN KEY (cotacao_id) REFERENCES public.cotacoes(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Garante que o PostgREST recarregue o cache de schema e enxergue a FK.
NOTIFY pgrst, 'reload schema';
