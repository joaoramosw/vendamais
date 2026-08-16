# VendaMais

Plataforma B2B de cotação de preços (e-procurement) em português. O empresário monta listas de produtos e envia cotações; o fornecedor responde com preço por item, prazo e observações; o empresário compara as propostas por item e exporta o resultado.

## Arquitetura

**Uma única aplicação Next.js.** UI e API vivem no mesmo projeto e no mesmo deploy:

```
Browser
   ↓
VendaMais (Next.js na Vercel)
   ├── páginas / UI          (App Router, Server + Client Components)
   └── API em /api/**        (Route Handlers → src/server/**)
                  ↓
            Supabase (Postgres + Auth + Storage)
```

Não existe backend separado. Até 08/2026 o domínio de cotações/propostas rodava num serviço NestJS à parte na porta 3001; ele foi incorporado como Route Handlers e removido. **Nenhum passo do desenvolvimento ou do deploy exige subir um segundo servidor.**

| Camada | Onde fica |
|---|---|
| Telas | `src/app/**` (rotas), `src/components/**` |
| API | `src/app/api/**` — só auth + validação, sem regra de negócio |
| Domínio | `src/server/**` — cotações, propostas, fornecedor, exportação |
| Cliente da API | `src/lib/api/*.ts` (browser) — chama `/api` na mesma origem |
| Server Actions | `src/actions/**` — produtos, categorias, usuários, tema |
| Acesso a dados | `@supabase/supabase-js` direto; sem ORM |

Autenticação é do Supabase Auth. As rotas de API do empresário exigem `Authorization: Bearer <access_token>` e papel `admin` (`users` → `roles.key`); as do fornecedor exigem só sessão válida; o link público da proposta é autenticado pelo `token_acesso` do convite.

**A service role key bypassa RLS**, então a autorização é imposta explicitamente no servidor (`src/server/auth.ts` + checagem de dono em cada service) — RLS é defesa em profundidade, não a fronteira.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · Supabase · Zod · ExcelJS + PDFKit (exportação) · Recharts.

## Rodando localmente

Requisitos: **Node 20+** e um projeto Supabase.

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do seu projeto Supabase
npm run dev                  # http://localhost:3000 — sobe o sistema inteiro
```

### Variáveis de ambiente

Ver `.env.example`. Resumo:

| Variável | Onde é usada | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client (sessão do usuário) | sim |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | client | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | **só server** — nunca com prefixo `NEXT_PUBLIC_` | sim |
| `NEXT_PUBLIC_API_URL` | base da API; use `/api` | não (padrão `/api`) |
| `NGROK_AUTHTOKEN` | só para `npm run dev:tunnel` | não |

## Comandos

```bash
npm run dev         # desenvolvimento (UI + API juntos)
npm run build       # build de produção
npm start           # serve o build
npm test            # testes unitários (node:test via tsx)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run dev:tunnel  # expõe o localhost via ngrok (opcional, manual)
```

### Verificação ponta a ponta

```bash
node scripts/smoke-api.mjs                                # contra o localhost
node scripts/smoke-api.mjs --base=https://<preview>.vercel.app
```

Exercita o fluxo crítico inteiro (criar → publicar → convidar → proposta → ranking → aceitar → exportar xlsx/pdf → excluir), mais checagens de autenticação, IDOR e das rotas de debug removidas. **Escreve no banco**: cria um admin efêmero e uma cotação `[SMOKE]`, e apaga tudo que criou no final. Execução sempre manual — nunca roda em build nem em hook.

## Banco de dados

Supabase gerenciado. As migrations ficam em `supabase/migrations/`, numeradas, e são aplicadas **manualmente no SQL Editor** — não há pipeline automático. Antes de confiar em qualquer nome de coluna, confirme contra o banco real: o schema divergiu do código no passado (ver `CLAUDE.md`).

Migrations pendentes fazem a aplicação degradar, nunca quebrar: o servidor testa a existência da coluna/tabela em runtime e desliga só o recurso correspondente (ver os probes em `src/server/**`).

## Deploy

Um projeto na Vercel, framework Next.js, sem configuração especial de build.

1. Configure as variáveis acima em **Production** e **Preview** (a service role sem `NEXT_PUBLIC_`).
2. No Supabase → Authentication → URL Configuration, inclua o domínio da Vercel em **Site URL** e **Redirect URLs** — senão os links de recuperação de senha apontam para `localhost`.
3. Push na branch → deploy Preview → rode `scripts/smoke-api.mjs --base=<preview>` → promova para Production.

## Documentação

- `CLAUDE.md` — decisões de arquitetura, armadilhas conhecidas e histórico de correções. Leitura obrigatória antes de mexer em cotações/propostas.
- `analysis_results.md` — fluxo de negócio detalhado.
- `markdown/config-atual-supabase.md` — dicionário de dados.
