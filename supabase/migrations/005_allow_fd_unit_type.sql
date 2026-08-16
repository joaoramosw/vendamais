-- Align cotacao_itens.tipo_unidade with the units supported by the app.
-- This keeps existing databases compatible with FD (Fardo).

ALTER TABLE public.cotacao_itens
  ADD COLUMN IF NOT EXISTS tipo_unidade text NOT NULL DEFAULT 'UN';

UPDATE public.cotacao_itens
SET tipo_unidade = upper(tipo_unidade)
WHERE tipo_unidade IS NOT NULL
  AND tipo_unidade <> upper(tipo_unidade);

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.cotacao_itens'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%tipo_unidade%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.cotacao_itens DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;
END $$;

ALTER TABLE public.cotacao_itens
  ALTER COLUMN tipo_unidade SET DEFAULT 'UN';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cotacao_itens_tipo_unidade_check'
      AND conrelid = 'public.cotacao_itens'::regclass
  ) THEN
    ALTER TABLE public.cotacao_itens
      ADD CONSTRAINT cotacao_itens_tipo_unidade_check
      CHECK (tipo_unidade IN ('UN', 'CX', 'DZ', 'FD'));
  END IF;
END $$;
