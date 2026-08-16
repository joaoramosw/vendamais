-- =============================================================================
-- 008: Users, Roles, Permissions
--
-- Substitui o modelo profiles/tipo/global_role/memberships por:
--   users (tabela principal)
--   roles (admin | supplier)
--   permissions (granularidade por chave)
--   role_permissions (N:N)
--
-- Organizations vira campo descritivo em users (organization_name).
-- Memberships e profiles ficam como backup, sem uso no código novo.
-- =============================================================================

-- 1. Tabelas de autorização ---------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 2. Tabela users -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  username text UNIQUE,
  role_id uuid NOT NULL REFERENCES roles(id),
  organization_name text,
  active_organization_id uuid,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 3. Seed de roles ------------------------------------------------------------

INSERT INTO roles (key, name) VALUES
  ('admin', 'Administrador'),
  ('supplier', 'Fornecedor')
ON CONFLICT (key) DO NOTHING;

-- 4. Seed de permissions ------------------------------------------------------

INSERT INTO permissions (key, description) VALUES
  ('users.read', 'Visualizar lista de usuarios'),
  ('users.create', 'Criar novos usuarios'),
  ('users.update', 'Editar papéis e dados de usuarios'),
  ('users.disable', 'Desativar/reativar usuarios'),
  ('quotes.manage', 'Criar, publicar e gerenciar cotacoes'),
  ('quotes.respond', 'Enviar propostas para cotacoes'),
  ('products.manage', 'Gerenciar catalogo de produtos'),
  ('categories.manage', 'Gerenciar categorias'),
  ('dashboard.read', 'Visualizar dashboard')
ON CONFLICT (key) DO NOTHING;

-- 5. Seed de role_permissions --------------------------------------------------

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'users.read', 'users.create', 'users.update', 'users.disable',
  'quotes.manage', 'products.manage', 'categories.manage', 'dashboard.read'
)
WHERE r.key = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'quotes.respond', 'dashboard.read'
)
WHERE r.key = 'supplier'
ON CONFLICT DO NOTHING;

-- 6. Migrar dados de profiles → users -----------------------------------------

INSERT INTO users (id, nome, email, username, role_id, organization_name, active_organization_id, must_change_password, created_at)
SELECT
  p.id,
  p.nome,
  p.email,
  p.username,
  CASE
    WHEN p.role = 'admin' THEN (SELECT id FROM roles WHERE key = 'admin')
    ELSE (SELECT id FROM roles WHERE key = 'supplier')
  END,
  p.empresa,
  p.active_organization_id,
  false,
  p.created_at
FROM profiles p
ON CONFLICT (id) DO NOTHING;

-- 7. RLS na tabela users ------------------------------------------------------

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer autenticado pode ver (lista de usuarios é visível para admin)
DROP POLICY IF EXISTS "Users visiveis para autenticados" ON users;
CREATE POLICY "Users visiveis para autenticados"
  ON users FOR SELECT TO authenticated USING (true);

-- UPDATE: só o próprio usuário pode editar seu perfil via client
DROP POLICY IF EXISTS "Usuario edita proprio perfil" ON users;
CREATE POLICY "Usuario edita proprio perfil"
  ON users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT: só o próprio usuário (on_auth_user_created trigger)
DROP POLICY IF EXISTS "Usuario cria proprio perfil" ON users;
CREATE POLICY "Usuario cria proprio perfil"
  ON users FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- 8. RLS nas tabelas de roles/permissions (leitura apenas) ---------------------

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Roles public read" ON roles;
CREATE POLICY "Roles public read" ON roles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permissions public read" ON permissions;
CREATE POLICY "Permissions public read" ON permissions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Role permissions public read" ON role_permissions;
CREATE POLICY "Role permissions public read" ON role_permissions FOR SELECT USING (true);

-- 9. Atualizar trigger handle_new_user para criar em users ---------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, nome, email, role_id, must_change_password)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nome',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    CASE
      WHEN NEW.raw_user_meta_data->>'role' = 'admin'
        THEN (SELECT id FROM roles WHERE key = 'admin')
      ELSE (SELECT id FROM roles WHERE key = 'supplier')
    END,
    false
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Se users ainda não existir (antes da migration), ignora silenciosamente.
  -- O ensure-user.ts cuidará de criar o registro depois.
  RAISE WARNING 'handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar o trigger para garantir que aponta para a função atualizada
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
