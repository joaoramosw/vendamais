# Auditoria Fase 1 — Sistema de Tema Personalizável + Editor da Home

Relatório somente-leitura. Nenhum código de produto foi alterado nesta fase (as únicas edições
desta sessão foram um bug-fix isolado e não relacionado: o botão "Escanear" em três telas não
fechava o scanner ao clicar de novo — corrigido separadamente, fora do escopo deste documento).

Data: 2026-08-01. Repositório: `/mnt/c/Desenvolvimento/vendamais`.

---

## 1.1 Mapa da aplicação

### Rotas (todas as `page.tsx` sob `src/app/**`)

| Rota | Grupo | Server/Client | Público/Protegido | Observação |
|---|---|---|---|---|
| `/` | — | Server | Público | `src/app/page.tsx`, landing page |
| `/fornecedores` | — | Server | Público | listagem pública de fornecedores |
| `/convite/[token]` | — | Server | Público (auto-redireciona se logado) | redireciona para `/empresario/dashboard` se já houver sessão |
| `/proposta/[token]` | — | Server | Público, sem auth Supabase | token-gated via API externa (backend NestJS), fluxo 100% anônimo |
| `/trocar-senha` | — | **Client** | **Gap — ver 1.3/achado de segurança** | não coberto pelo middleware nem por layout; só a Server Action que ele chama verifica sessão |
| `/login`, `/cadastro`, `/esqueci-senha` | `(auth)` | Client | Público (middleware redireciona usuário já logado para fora) | |
| `/empresario`, `/empresario/dashboard`, `/categorias`, `/produtos*`, `/segmentos`, `/ranking`, `/cotacoes*`, `/lista-cotacao` | `(dashboard)/empresario` | Server (exceto `cotacoes/nova`) | Protegido (role admin) | `/empresario/cotacoes/nova` é a única página client entre as admin — depende 100% dos layouts para auth |
| `/empresario/usuarios`, `/usuarios/[id]/editar` | `(dashboard)/empresario` | Server | Protegido (admin + permissão `users.read`) | `requirePermission` chamada direto no corpo da página (ver 1.3) |
| `/fornecedor`, `/dashboard`, `/cotacoes*`, `/propostas`, `/configuracoes` | `(dashboard)/fornecedor` | Server | Protegido (role supplier) | |
| `/api/debug-profile`, `/api/fix-profiles`, `/api/reload-schema` | — | Route Handler | **Sem guard — ver achado de segurança 1.3** | |

### Onde a auth é verificada

- **Middleware** (`src/middleware.ts` → `src/lib/supabase/middleware.ts::updateSession`) roda em quase toda rota (matcher exclui só `_next/static`, `_next/image`, favicon e extensões de imagem). Faz mais que refresh de sessão:
  1. Refresca cookie via `supabase.auth.getUser()`.
  2. Bloqueia `/empresario*`/`/fornecedor*` para usuário anônimo (`isProtectedRoute` = `startsWith('/empresario') || startsWith('/fornecedor')`) → redirect `/login`.
  3. Redireciona usuário já logado para fora de `/login`, `/cadastro`, `/esqueci-senha`, resolvendo `role` via `users.roles(key)`.
  4. **Não cobre `/trocar-senha`, `/proposta/*`, `/convite/*`, `/`, `/fornecedores` nem `/api/*`.**
- **`getCurrentUser()`** (`src/lib/auth/current-user.ts`, memoizado com `cache()`): uma única query `users` ⋈ `roles(key)`; se a linha não existir ou `roles.key` for nulo, cai para `'supplier'` (fail-safe correto — nunca erra para o lado de mais privilégio).
- **Guards** (`src/lib/auth/guard.ts`): `requireAuth`/`requirePermission`/`requireAnyPermission`/`requireRole`/`requireAdmin`/`requireAdminWithClient` — todos **lançam `Error`** (não fazem `redirect`), pensados para Server Actions (`catch` → `{ error }}`). `writeAuditLog` usa o admin client (service role) para gravar em `audit_log`.
- **Layouts** — três camadas:
  - `(dashboard)/layout.tsx`: `getCurrentUser()` (o `if (!user) redirect('/login')` logo depois é código morto — `getCurrentUser()` já redireciona internamente e nunca retorna falsy) + redirect para `/trocar-senha` se `mustChangePassword`.
  - `(dashboard)/empresario/layout.tsx` / `fornecedor/layout.tsx`: segunda camada, `role !== 'admin'|'supplier'` → redirect cruzado.
  - Página `usuarios/*`: terceira camada, `requirePermission('users.read')` chamada **direto no corpo da página** (não numa Server Action) — como essa função lança `Error` em vez de fazer `redirect`, uma negação aqui bate na error boundary genérica do Next em vez de um redirect amigável.

### Hierarquia de layouts

```
src/app/layout.tsx                    (root: html/body, fonts, toaster — sem auth)
├── (auth)/layout.tsx                 (shell centralizado — sem auth)
│   └── login | cadastro | esqueci-senha
├── (dashboard)/layout.tsx            (GATE 1: getCurrentUser + mustChangePassword)
│   ├── empresario/layout.tsx         (GATE 2: role === 'admin')
│   │   └── dashboard, categorias, produtos*, segmentos, ranking,
│   │       cotacoes*, lista-cotacao, usuarios* (GATE 3: requirePermission)
│   └── fornecedor/layout.tsx         (GATE 2: role === 'supplier')
│       └── dashboard, cotacoes*, propostas, configuracoes
├── /  , /fornecedores                (públicas, sem layout de auth)
├── /convite/[token], /proposta/[token]  (públicas, sem layout de auth)
└── /trocar-senha                     (fora do middleware E fora de qualquer layout — gap)
```

---

## 1.2 Panorama de estilo

### Confirmado
- Tailwind v4 100% via CSS (`@import "tailwindcss"` em `globals.css`), **sem** `tailwind.config.*` no repo (confirmado por busca no root).
- **Sem `next-themes`** em lugar nenhum (grep zero-resultado em `package.json` e no código).
- Dark mode = classe `.dark` fixa, hardcoded, em `<html lang="pt-BR" className="dark">` (`src/app/layout.tsx:31`) — sem toggle, sem `prefers-color-scheme`, sem `suppressHydrationWarning` (não precisa, é estático).

### `@theme inline` completo (`src/app/globals.css`)

```css
@theme inline {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --color-primary-50: #EEF2FF;  --color-primary-100: #E0E7FF;  --color-primary-200: #C7D2FE;
  --color-primary-300: #A5B4FC; --color-primary-400: #818CF8;  --color-primary-500: #6366F1;
  --color-primary-600: #4F46E5; --color-primary-700: #4338CA;  --color-primary-800: #3730A3;
  --color-primary-900: #312E81;

  --color-neutral-50: #F8FAFC;  --color-neutral-100: #F1F5F9; --color-neutral-200: #E2E8F0;
  --color-neutral-300: #CBD5E1; --color-neutral-400: #94A3B8; --color-neutral-500: #64748B;
  --color-neutral-600: #475569; --color-neutral-700: #334155; --color-neutral-800: #1E293B;
  --color-neutral-900: #0F172A;

  --color-success: #10B981; --color-success-light: #D1FAE5;
  --color-warning: #F59E0B; --color-warning-light: #FEF3C7;
  --color-danger:  #EF4444; --color-danger-light:  #FEE2E2;
  --color-info:    #3B82F6; --color-info-light:    #DBEAFE;

  --shadow-xs: 0 1px 2px rgba(0,0,0,.04);
  --shadow-sm: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,.07), 0 2px 4px -2px rgba(0,0,0,.05);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,.08), 0 4px 6px -4px rgba(0,0,0,.04);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,.1), 0 8px 10px -6px rgba(0,0,0,.04);

  --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px; --radius-full: 9999px;
}
```

CSS global relevante:
```css
body {
  font-family: var(--font-sans);
  background: var(--color-neutral-50);
  color: var(--color-neutral-800);
  line-height: 1.6;
}
.dark body, html.dark body {
  background: var(--color-neutral-900);
  color: var(--color-neutral-200);
}
.focus-ring:focus-visible {
  box-shadow: 0 0 0 2px white, 0 0 0 4px var(--color-primary-500); /* "white" hardcoded, sem override dark */
  border-radius: var(--radius-md);
}
@media (max-width: 640px) {
  button, a, input, select, textarea { min-height: 44px; } /* touch target ok */
  input, select, textarea { font-size: 16px; } /* evita zoom iOS */
}
body { padding: env(safe-area-inset-*); } /* notch */
```

**Achado técnico central (define a Fase 2 inteira — ver 2.0):** `@theme inline` faz o Tailwind **inlinar os valores literais no CSS gerado**, não gerar `var(--color-primary-500)` no output. Isso significa que mudar `--color-primary-500` em runtime (via `style` inline no `<html>`, por exemplo) **não teria nenhum efeito** nas classes `bg-primary-500`/`text-primary-500`/etc. já compiladas. Confirmado lendo o CSS gerado seria o próximo passo prático, mas o comportamento de `@theme inline` é documentado assim pelo próprio Tailwind v4 — é a razão de ser da recomendação da seção 2.0 abaixo.

### Fontes
`next/font/google` carrega Inter (`--font-inter`) e JetBrains Mono (`--font-jetbrains`), aplicadas via `className` no `<body>`. **Só que** `globals.css` declara `--font-sans`/`--font-mono` como strings literais (`"Inter"`, `"JetBrains Mono"`) **desconectadas** das variáveis geradas pelo `next/font` — funciona hoje porque `next/font` injeta o `@font-face` globalmente, mas os dois sistemas de token de fonte não estão de fato ligados um ao outro. Isso importa para a Fase 2 (troca de fonte por preset): hoje não há um caminho limpo para um preset "trocar a fonte" sem tocar os dois lugares.

### Componentes UI (`src/components/ui/`)
Só **`button.tsx`** e **`badge.tsx`** usam CVA. `card.tsx` e `input.tsx` (as duas primitivas mais usadas do app) não têm variant system e — achado importante — **hardcodam cor em vez de token**:

```ts
// card.tsx
"bg-[#1F2937] border border-white/[0.06] rounded-[var(--radius-lg)] shadow-xs"
// CardTitle: text-white (sem dark:, sem light mode)
// CardDescription: text-gray-400

// input.tsx
"bg-[#1a2332] text-gray-100 placeholder:text-gray-500 ... border-white/10"
```

Ou seja: **mesmo depois de trocar `@theme inline` → `@theme`**, Card e Input continuariam imunes a qualquer override de tema, porque não referenciam nenhuma classe de token (`bg-neutral-800`, por exemplo) — usam hex arbitrário direto. Esses dois arquivos são pré-requisito de código para a Fase 2, não só os "hardcodes de página".

`button.tsx` também mistura fallback de paleta padrão do Tailwind com token: variantes `danger`/`success` usam token no estado base (`bg-danger`) mas `hover:bg-red-600`/`hover:bg-emerald-600` no hover — inconsistente. `badge.tsx` tem 12 variantes e nenhuma usa `--color-success/warning/danger/info` — todas usam `blue-50`/`green-50`/`amber-50`/`red-50` crus.

### Inventário de hardcodes fora do sistema de token

Escopo: `src/**`, buscas via `rg`.

**(a) Hex/rgb arbitrário em bracket syntax** — 134 ocorrências. Paleta escura recorrente e não-tokenizada: `#111827`, `#1F2937`, `#1a2332`, `#0B1220`, `#0f1720`, `#0B0F19` (efetivamente uma segunda escala "neutral" hand-rolled, duplicando `--color-neutral-*`). Maiores concentrações: `DraftListClient.tsx` (10), `ProductsTable.tsx` (9), `cotacao-detalhes-client.tsx` (6), `SupplierComparisonTable.tsx` (6), `PropostaForm.tsx` (6), `cadastro/page.tsx` (6). **Achado estrutural**: o hex-hardcode está no próprio `ui/card.tsx` e `ui/input.tsx` — não é só nível de página.

**(b) Paleta Tailwind default fora do sistema** (`indigo`/`gray`/`slate`/`zinc`/`red`/`green`/`blue`/`yellow`/`amber`/`emerald`, excluindo `neutral`/`primary` que são tokens legítimos) — **1.343 ocorrências em 69 arquivos**. Top: `cotacao-detalhes-client.tsx` (130), `SupplierComparisonTable.tsx` (103), `DraftListClient.tsx` (75), `ProductsTable.tsx` (66), `ranking-client.tsx` (58), `UsersTable.tsx` (54). A família `(auth)/*` + `sidebar.tsx` usa `gray-*`/`indigo-*`/`red-*` de forma consistente (sidebar: 8×`gray`, 6×`indigo`, 2×`red`). Mesmo `src/actions/dashboard.ts` (Server Action) embute strings de classe com paleta crua (`text-indigo-400`, `bg-indigo-500`) — o vazamento não é só de componente, é de dado retornado por action.

**(c) `bg-white`/`text-white`/`bg-black`/`text-black` literais** (ignoram `dark:` semântico) — 345 ocorrências em 100+ arquivos. `app/page.tsx` sozinho tem 12 (mistura `bg-white` com `dark:bg-neutral-900` — funciona, mas não é um token semântico de "superfície").

**(d) Raio arbitrário fora de `--radius-*`**: só 3 ocorrências reais de `rounded-[Npx]` sem var, todas em `app/page.tsx` (`rounded-[40px]`, `rounded-[32px]`, `rounded-[48px]`, seção hero/CTA) — decoração grande intencional, mas evidencia que a escala de token não vai além de `xl` (16px); não existe `--radius-2xl/3xl`. `rounded-2xl`/`rounded-3xl`/`rounded-full` (Tailwind default, não tokenizados) somam 128 usos combinados espalhados em cards/avatares/pills.

**(e) Tamanho de fonte arbitrário / peso pesado**: `text-[Npx]` — 107 ocorrências, quase sempre `text-[9px]/[10px]/[11px]` (um degrau "micro" abaixo de `text-xs` que devia ser promovido a token/utilitário em vez de repetido). Concentração: `SupplierComparisonTable.tsx` (25), `cotacao-detalhes-client.tsx` (15). `font-black` — 48 ocorrências em 16 arquivos (não é "fora do token" per se, mas é candidato a virar um utilitário `.text-stat`).

**ROI de correção**: por volume bruto, as tabelas de cotação (`cotacao-detalhes-client.tsx`, `SupplierComparisonTable.tsx`, `DraftListClient.tsx`, `ProductsTable.tsx`) são as piores. Mas por **alcance estrutural**, `(auth)/layout.tsx` + `sidebar.tsx` + `ui/card.tsx` + `ui/input.tsx` valem mais a pena corrigir primeiro — são chrome compartilhado; consertar esses 4 arquivos já tokeniza uma fatia grande de telas de uma vez, e são pré-requisito técnico (card/input) para qualquer coisa responder a tema em runtime.

### Dark mode
Fixo via classe `.dark` estática — nenhum estilo depende de detecção de sistema ou de toggle. Praticamente todo componente usa `dark:` variants extensivamente (o app foi desenhado dark-first e depois ganhou variantes claras "por cima"), exceto `ui/card.tsx` e `ui/input.tsx`, que são **dark-only** (sem nenhum par claro — ver achado acima).

---

## 1.3 Erros e riscos

### TypeScript / lint
- `npx tsc --noEmit` — **limpo, 0 erros.**
- `npm run lint` — **0 erros, 33 warnings**, nenhum crítico: `no-unused-vars` (a maioria — variáveis/imports mortos em `invitations.ts`, `user-impersonation.ts`, `SupplierComparisonTable.tsx`, `cotacao-detalhes-client.tsx`, `roles.ts` etc.), `react-hooks/exhaustive-deps` (3 casos: `cotacao-detalhes-client.tsx:88` falta `propostas`; `enviar-proposta-form.tsx:105` falta `cotacaoItens`), `@next/next/no-img-element` (2×, `app/page.tsx:53,58` — logos de clientes usando `<img>` cru em vez de `next/image`), e um aviso do React Compiler sobre `watch()` do react-hook-form não poder ser memoizado (`enviar-proposta-form.tsx:107`, informativo, não é bug).

### 🔴 Achado de segurança (bloqueante) — três Route Handlers sem nenhum guard, usando service role
Não estava no escopo original do prompt, mas apareceu ao mapear rotas e vale reportar como bloqueante antes de tocar em qualquer coisa nova de auth/tema:

- **`GET /api/debug-profile`** (`src/app/api/debug-profile/route.ts`) — sem guard de admin; consulta a tabela `profiles`, que segundo o próprio CLAUDE.md pode já não refletir o schema real (`users`/`roles`). Vaza `nome`/`tipo`/`empresa`/`global_role` do usuário autenticado (ou "no user" se anônimo) — impacto baixo (exige sessão), mas é debug tooling exposto em produção.
- **`POST /api/fix-profiles`** (`src/app/api/fix-profiles/route.ts`) — **sem nenhum guard, nem de sessão**. Usa `createAdminClient()` (service role, bypassa RLS) e tem **hardcoded** o e-mail do próprio usuário (`devjoaoramos@gmail.com`) sendo promovido a `global_role: 'super_admin'` na tabela `profiles`. Qualquer requisição `POST` anônima para essa rota executa essa lógica. O comentário no topo do arquivo já diz "Can be safely removed after execution".
- **`GET /api/reload-schema`** (`src/app/api/reload-schema/route.ts`) — sem guard; instancia um client Supabase direto com `SUPABASE_SERVICE_ROLE_KEY` (fora do padrão "nunca fora de Server Actions/rotas server-only" — tecnicamente é uma rota server-only, mas sem autenticação, então qualquer um na internet pode disparar chamadas com a service role key) para forçar reload do cache do PostgREST.

Nenhuma dessas três é bloqueada pelo middleware (`isProtectedRoute` só cobre `/empresario*`/`/fornecedor*`) nem por `getCurrentUser`/guards de `src/lib/auth/guard.ts`. Recomendação: remover as três (todas têm cara de script de manutenção pontual, não de feature) ou, no mínimo, colocar atrás de `requireAdmin()` antes de mexer em qualquer coisa nova nesta área do código.

### Outro gap de auth (não bloqueante)
`/trocar-senha` não é coberto pelo `isProtectedRoute` do middleware nem por nenhum layout — a página client renderiza para qualquer visitante, autenticado ou não (a mutação em si é segura, pois a Server Action correspondente verifica sessão). Baixo risco (não vaza dado, só expõe o formulário), mas inconsistente com o resto do modelo de proteção.

### Hidratação
- Não há nenhuma chamada `useEffect` para aplicar estilo/tema hoje (confirma que a Fase 2 começa de um estado limpo nesse quesito).
- `cz-shortcut-listen`: não verificado nesta sessão (precisa aba anônima) — sinalizo que a validação foi pulada, não que o mismatch existe ou não.
- `new Date().getFullYear()` no footer de `app/page.tsx:228`: **não é risco de hidratação** — `page.tsx` não tem `'use client'` nem `export const dynamic`/`revalidate`, então é 100% Server Component sem fronteira de cliente ali; Next vai pré-renderizar estaticamente no build. O risco real é **staleness de build**: se o site não for re-buildado/re-deployado na virada do ano, o footer mostra o ano do último build, não o ano corrente. Vale trocar por algo resolvido em request-time se isso importar, mas não é um bug de hidratação como o prompt supôs.

### Tratamento de erro/loading/disabled em chamadas de API
O caso apontado no prompt (`handleSend` em `DraftListClient.tsx:696`) **já está bem tratado**: guarda contra double-submit via `sendingRef`, valida antes de enviar, tem branch offline/online, `try/catch` com `throw new Error(result.error)` em caso de falha do backend, e um catch aninhado para a falha (não-fatal) de convite pós-publicação, exibida como aviso separado sem desfazer a publicação. `loading={sending}` é passado ao botão. Não encontrei um caso comparável de "sem tratamento" ao vasculhar o restante do componente — se havia uma ocorrência mais específica em mente, vale apontar o trecho exato.

### Acessibilidade
- **Contraste**: `(auth)/layout.tsx` força gradiente escuro fixo (`from-[#0B0F19] via-[#111827] to-[#0B0F19]`) com `text-white` — funciona hoje (fundo sempre escuro), mas está **desconectado de qualquer sistema de tema**: se a Fase 2 permitir trocar cor primária/fundo, essa tela específica não vai refletir nada, porque não usa nenhuma classe de token. É o mesmo achado do `ui/card.tsx`/`ui/input.tsx` — pré-requisito de código antes do tema poder ser "global de verdade".
- `.focus-ring:focus-visible` usa `0 0 0 2px white` hardcoded — em telas com fundo já claro (se um preset futuro permitir light mode em áreas específicas) o anel branco pode ficar invisível contra fundo branco. Sem override `.dark .focus-ring`.
- Não foi feita auditoria de contraste numérica (WCAG) nesta rodada — fica para a função de validação da Fase 2.1.6 (`contrast.ts`), que é o lugar certo para isso.

### Responsividade
- Tabelas (`ProductsTable.tsx`, `UsersTable.tsx`, `CategoriesTable.tsx`) já envolvem o `<table>` em `<div className="overflow-x-auto">` — padrão correto, sem achado aqui.
- Sidebar tem tratamento mobile dedicado (`mobile-nav.tsx`, toggle `lg:hidden`/`hidden lg:flex`, overlay com `bg-black/30`).
- `globals.css` já trata touch target mínimo de 44px e `font-size: 16px` em inputs para não disparar zoom no iOS abaixo de 640px — bom sinal, não precisa de trabalho extra na Fase 2.
- Não foi feita varredura exaustiva de quebra visual pixel-a-pixel abaixo de 768px nesta rodada (fora do escopo de leitura de código puro); se quiser, isso é mais rápido de validar com o app rodando no navegador do que por grep.

---

## 1.4 Proposta de arquitetura de tema (com trade-offs) — responde à pergunta da Fase 2.0

**Pergunta central**: `@theme inline` inlina valores no CSS compilado — overrides de CSS var em runtime não têm efeito nas classes já geradas. Confirmado lendo o bloco de `globals.css` (é o comportamento documentado do Tailwind v4 para `@theme inline` vs `@theme`).

**Recomendação: trocar `@theme inline` → `@theme`.** Alternativa (migrar cada utilitário afetado para `var(...)` explícito manualmente) é estritamente mais trabalhosa e mais frágil — teria que ser refeita a cada nova classe Tailwind usada no futuro, enquanto `@theme` puro resolve isso uma vez, para sempre, no nível do compilador. Não há motivo real para preferir a alternativa aqui; a troca é mecânica e, pelo que a auditoria mostrou, não deveria mudar a aparência (os valores em `:root`/`.dark` continuam os mesmos, só passam a ser referenciados via `var()` em vez de inlinados).

**Trade-off real a documentar**: a troca sozinha **não é suficiente**. Ela destrava overrides para qualquer classe que já usa uma cor tokenizada (`bg-primary-500`, `text-neutral-800` etc.), mas:
1. `ui/card.tsx` e `ui/input.tsx` (as duas primitivas mais usadas) não usam essas classes — usam hex arbitrário (`bg-[#1F2937]`, `bg-[#1a2332]`). Essas duas precisam ser reescritas para consumir token antes de responderem a tema, senão o painel de admin muda a cor mas metade da UI continua com a cor fixa antiga.
2. `(auth)/layout.tsx` e `sidebar.tsx` têm o mesmo problema em escala de página/chrome inteiro.
3. Não existe token de raio acima de `xl` (16px) — os 3 usos de `rounded-[40/32/48px]` em `app/page.tsx` ficariam fora do controle do admin a menos que se adicione `--radius-2xl`/`--radius-3xl` aos tokens.
4. Fonte: o preset trocar a família exige tocar dois lugares desconectados hoje (`next/font` no `layout.tsx` raiz + `--font-sans` em `globals.css`) — ou aceitar como limitação documentada (o próprio prompt já antecipa isso: "fontes além de Inter/Mono exigem carregar via next/font").

**Ordem de prioridade sugerida para a "etapa 1" (migração de hardcodes, neutra)**: `ui/card.tsx` e `ui/input.tsx` primeiro (bloqueiam tudo mais), depois `(auth)/layout.tsx` + `sidebar.tsx` (maior alcance por arquivo), e só depois as tabelas de cotação (maior volume, mas cada uma isolada — não bloqueia as outras).

**Sobre 403 literal vs `{error}`** (pergunta 4 do prompt): dado que os guards existentes em `src/lib/auth/guard.ts` já são 100% baseados em `throw new Error` + `{ error }` nas Server Actions (nenhum guard atual devolve HTTP 403 literal), manter esse padrão para as novas escritas de tema em `src/actions/theme.ts` é consistente com o resto do código e não exige nada novo. Só valeria a pena um Route Handler com 403 literal se o admin panel precisar ser chamado por algo fora de React (não é o caso aqui). Recomendo `{ error: 'Acesso negado.' }` via Server Action, seguindo o padrão existente — mas essa é a pergunta 4 do prompt, então aguardo confirmação explícita antes de fixar isso na Fase 2.

---

## Lista de erros por severidade

**Bloqueante**
1. `POST /api/fix-profiles` sem auth, com service role, hardcoded para promover uma conta a `super_admin` numa tabela (`profiles`) que pode já estar obsoleta — remover ou proteger antes de qualquer trabalho novo na área de auth/admin.
2. `GET /api/reload-schema` sem auth, com service role key exposta a chamada anônima.
3. `GET /api/debug-profile` sem guard de admin (menor impacto, mas mesmo padrão).

**Importante**
4. `ui/card.tsx` e `ui/input.tsx` hardcodam hex de fundo (`#1F2937`/`#1a2332`) e `text-white`/`text-gray-400` sem nenhuma variante clara — pré-requisito de código para o tema funcionar de verdade (ver 1.4).
5. `(auth)/layout.tsx` com gradiente hex fixo + `text-white` fixo — mesma classe de problema, maior alcance (toda tela não-autenticada).
6. `requirePermission` chamada direto no corpo de `usuarios/page.tsx`/`usuarios/[id]/editar/page.tsx` — lança `Error` não capturado em vez de redirect amigável (poderia usar `redirect` diretamente, ou uma tela de erro dedicada).
7. `/trocar-senha` fora da cobertura do middleware e de qualquer layout de auth.
8. `(dashboard)/layout.tsx:17` — `if (!user) redirect('/login')` é código morto (dead code), `getCurrentUser()` já garante não-nulo.

**Cosmético**
9. 33 warnings de lint (nenhum bloqueante) — variáveis/imports não usados, 2 deps faltando em hooks, 2 `<img>` sem `next/image`.
10. Inconsistência `danger`/`success` de `button.tsx` usando paleta Tailwind crua no hover em vez do token.
11. `badge.tsx` com 12 variantes, nenhuma usando os tokens semânticos (`--color-success/warning/danger/info`).
12. `.focus-ring` com `white` hardcoded no `box-shadow`, sem override dark.
13. Ausência de tokens de raio acima de 16px (3 usos arbitrários concentrados no hero/CTA da home).
14. `text-[9/10/11px]` repetido 107× — candidato a virar um passo de escala tipográfica oficial.
15. Footer da home com `new Date().getFullYear()` sujeito a staleness de build (não é bug de hidratação).

---

## Perguntas em aberto (do prompt original, ainda sem resposta sua)

1. Tema controla claro/escuro também, ou só cores/raio/fonte no dark atual? Reposta: Sim
2. Logo: URL em texto ou upload para Supabase Storage? Reposta : Ambos 
3. Blocos da home: 1:1 com os atuais, ou também "texto livre" novo? Atuais
4. 403 literal em Route Handler vs `{error}` em Server Action — recomendo `{error}` (ver 1.4), mas confirme. , faça o recomendado
5. Painel multi-tenant (tema por organização) ou global da instalação? Inicialmente global, mas deixe fundamentado para ser para ambos

Aguardando aprovação deste relatório (e resposta às 5 perguntas acima) antes de iniciar a Fase 2. Também recomendo decidir separadamente o que fazer com os três Route Handlers do achado de segurança — isso é independente do trabalho de tema e pode ser corrigido a qualquer momento.
