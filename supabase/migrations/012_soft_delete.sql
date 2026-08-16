-- =============================================================================
-- 012: Soft delete (users, products, categories, segmentos)
--
-- Nenhuma tabela do sistema tinha soft delete antes disso (só existia o ban
-- de auth pra usuários, que é outra coisa — não apaga a linha). Delete vira
-- UPDATE deleted_at = now(); toda leitura passa a filtrar deleted_at IS NULL.
-- =============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE segmentos ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- categories.slug, segmentos.slug e users.username tinham UNIQUE simples —
-- sem isso, um registro soft-deletado continuaria ocupando o slug/username
-- e bloquearia criar outro novo com o mesmo valor. Troca por índice único
-- parcial (só entre os não-deletados).
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key_active
  ON categories (slug) WHERE deleted_at IS NULL;

ALTER TABLE segmentos DROP CONSTRAINT IF EXISTS segmentos_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS segmentos_slug_key_active
  ON segmentos (slug) WHERE deleted_at IS NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key_active
  ON users (username) WHERE deleted_at IS NULL;
