-- =============================================================================
-- 022: Autenticação por telefone (e-mail sintético)
--
-- O telefone passa a ser o único identificador exposto na UI (login, cadastro,
-- criação de usuário pelo admin). O Supabase Auth continua sendo o dono da
-- sessão — RLS e auth.uid() intactos —, então cada conta guarda internamente
-- um e-mail no domínio reservado `phone.vendamais.local`, gerado a partir do
-- próprio número (ver src/lib/phone.ts). Sem OTP/SMS: telefone + senha.
--
-- Decisão de modelagem (divergência consciente do prompt da refatoração):
-- o prompt propunha criar as tabelas `fornecedores` e `empresarios`. Este
-- projeto já resolve perfil + papel em `users` + `roles` (ver o alerta no topo
-- do CLAUDE.md — `profiles`/`memberships` são de uma versão anterior do
-- modelo). Criar duas tabelas de perfil paralelas duplicaria a identidade e
-- exigiria reescrever RLS, guards e dashboards inteiros. O telefone passa a
-- viver em `users.whatsapp` (coluna já existente desde a migration 013 e já
-- usada para casar convite ↔ conta de fornecedor), com unicidade garantida
-- aqui. Papel continua vindo de `users.role_id -> roles.key`.
--
-- Aditivo: nada é recriado nem removido (gotcha #12 do CLAUDE.md).
--
-- ⚠️ Enquanto esta migration NÃO for rodada no SQL Editor do Supabase, o
-- cadastro/login por telefone continua funcionando: a checagem de telefone
-- duplicado é feita no servidor antes de criar a conta
-- (src/lib/auth/phone-auth.ts#phoneExists) e o e-mail sintético já é único no
-- Supabase Auth por construção. O que falta sem o índice é a rede de proteção
-- do banco contra duas contas com o mesmo número em uma corrida.
-- =============================================================================

-- Coluna já criada pela 013; repetida aqui para que rodar só a 022 num banco
-- novo não quebre.
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp text;

-- Normaliza o que já existe para a forma canônica (só dígitos, com DDI 55) —
-- é a mesma regra de src/lib/phone.ts#normalizePhone. Sem isso, o índice único
-- abaixo deixaria passar "(71) 99999-9999" e "5571999999999" como números
-- diferentes.
UPDATE users
SET whatsapp = CASE
  WHEN length(regexp_replace(whatsapp, '\D', '', 'g')) IN (10, 11)
    THEN '55' || regexp_replace(whatsapp, '\D', '', 'g')
  ELSE regexp_replace(whatsapp, '\D', '', 'g')
END
WHERE whatsapp IS NOT NULL
  AND whatsapp <> regexp_replace(whatsapp, '\D', '', 'g');

-- Descarta o que sobrou fora da faixa válida (12–13 dígitos com DDI) — lixo
-- de digitação antigo que impediria a criação do índice.
UPDATE users
SET whatsapp = NULL
WHERE whatsapp IS NOT NULL
  AND (length(whatsapp) NOT IN (12, 13) OR left(whatsapp, 2) <> '55');

-- Unicidade do telefone entre contas ativas. Parcial de propósito:
--   * `whatsapp IS NOT NULL` — contas legadas sem número continuam válidas;
--   * `deleted_at IS NULL` — soft delete (migration 012) não pode bloquear o
--     recadastro do mesmo número por outra pessoa.
CREATE UNIQUE INDEX IF NOT EXISTS users_whatsapp_unico_idx
  ON users (whatsapp)
  WHERE whatsapp IS NOT NULL AND deleted_at IS NULL;

-- Busca por telefone no login/cadastro (phoneExists) sem varrer a tabela.
CREATE INDEX IF NOT EXISTS users_whatsapp_idx ON users (whatsapp);
