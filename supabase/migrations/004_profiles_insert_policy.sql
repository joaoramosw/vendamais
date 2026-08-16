-- Allow authenticated users to create their own profile row.
-- This supports ensureProfile() for legacy users that do not yet have a profiles record.

CREATE POLICY "Usuário cria próprio perfil"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
