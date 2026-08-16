-- =============================================================================
-- 014: site_settings — tema personalizável + editor da home (rascunho/publicado)
--
-- Tabela "global" hoje (organization_id sempre NULL), mas desenhada pra não
-- exigir redesenho se/quando o painel virar multi-tenant: organization_id é
-- uma coluna solta, SEM FK (não existe tabela `organizations` real hoje — ver
-- src/actions/organizations.ts, módulo deprecated). Uma versão futura por
-- organização adicionaria linhas com organization_id preenchido, sem tocar
-- em PK nem migrar dado existente — só trocar o filtro de leitura de
-- `.is('organization_id', null)` para `.eq('organization_id', orgId)`.
--
-- Escrita só via service role (src/actions/theme.ts, requireAdminWithClient)
-- — por isso não há policy de INSERT/UPDATE/DELETE aqui.
-- =============================================================================

CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  theme_preset text NOT NULL DEFAULT 'default',
  theme_tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  home_blocks_draft jsonb NOT NULL DEFAULT '[]'::jsonb,
  home_blocks_published jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Garante uma única linha "global" (organization_id IS NULL). Linhas futuras
-- por organização (organization_id preenchido) não são afetadas por este
-- índice.
CREATE UNIQUE INDEX IF NOT EXISTS site_settings_global_singleton
  ON site_settings ((organization_id IS NULL))
  WHERE organization_id IS NULL;

INSERT INTO site_settings (organization_id, theme_preset, theme_tokens, home_blocks_draft, home_blocks_published)
SELECT NULL, 'default', '{}'::jsonb, '[]'::jsonb, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE organization_id IS NULL);

-- update_updated_at_column() já existe (criada em 002_products_module.sql)
CREATE TRIGGER site_settings_set_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Tema e home são públicos por natureza (renderizados na home e no login,
-- sem sessão). Sem policy de escrita — só o service role grava.
CREATE POLICY "site_settings_select_public"
  ON site_settings FOR SELECT USING (true);

-- Bucket de assets de tema (logo). Leitura pública; escrita só via service
-- role dentro de Server Actions já gateadas por requireAdminWithClient() —
-- ao contrário do bucket 'products' (002_products_module.sql), que checa a
-- tabela `profiles` (legada) em policy de INSERT/UPDATE/DELETE, aqui a
-- autorização já foi verificada no Server Action antes de chegar no Storage,
-- então não há necessidade de policy de escrita duplicando essa checagem
-- contra uma tabela que nem é mais a fonte de verdade de roles.
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "site_assets_storage_select"
  ON storage.objects FOR SELECT USING (bucket_id = 'site-assets');
