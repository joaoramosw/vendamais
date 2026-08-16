-- =============================================================================
-- 021: cotacao_grupos — agrupamento das cotações na tela de gerenciamento
--      (/empresario/cotacoes). Seleção múltipla → "Agrupar" move as cotações
--      escolhidas para um grupo nomeado, e a lista passa a renderizar por
--      grupo (recolhível), com "Sem grupo" no fim.
--
-- Por que no banco e não em localStorage: o grupo é dado de negócio
-- (organização das compras), não preferência de navegador — precisa
-- acompanhar o usuário entre dispositivos. Ordem/rótulo de coluna continuam
-- em localStorage; isso não.
--
-- Aditivo: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS, nunca
-- recriando tabela existente (gotcha #12 do CLAUDE.md).
--
-- ⚠️ Enquanto esta migration NÃO for rodada no SQL Editor do Supabase, a tela
-- continua funcionando: o backend detecta a ausência da tabela
-- (CotacoesService#gruposDisponiveis) e devolve `disponivel: false`, e a UI
-- desabilita só o botão "Agrupar", explicando o motivo. Nada mais quebra.
-- =============================================================================

CREATE TABLE IF NOT EXISTS cotacao_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Mesmo dono da cotação (`cotacoes.admin_id`). Sem FK de propósito: o
  -- modelo de usuário do projeto está dividido entre `profiles` (para onde a
  -- FK de cotacoes aponta) e `users`/`roles` (o modelo vivo) — ver o alerta
  -- de divergência no CLAUDE.md. Uma FK aqui amarraria a criação de grupo a
  -- essa inconsistência; o escopo por dono é garantido no backend, que é o
  -- único caminho de escrita.
  admin_id uuid NOT NULL,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cotacao_grupos_admin_id_idx ON cotacao_grupos (admin_id);

-- Um nome de grupo por dono — "Agrupar" reaproveita o grupo existente em vez
-- de criar duplicata invisível na lista.
CREATE UNIQUE INDEX IF NOT EXISTS cotacao_grupos_admin_nome_idx
  ON cotacao_grupos (admin_id, lower(nome));

-- ON DELETE SET NULL: apagar o grupo nunca apaga cotação — elas só voltam
-- para "Sem grupo".
ALTER TABLE cotacoes
  ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES cotacao_grupos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cotacoes_grupo_id_idx ON cotacoes (grupo_id);

-- Acesso exclusivamente pelo backend NestJS com a service role (mesmo
-- caminho de todas as escritas de cotação). RLS ligada sem policy = nenhum
-- acesso via anon/authenticated key, que é o comportamento desejado aqui.
ALTER TABLE cotacao_grupos ENABLE ROW LEVEL SECURITY;
