#!/usr/bin/env node
/*
 * Smoke test da API do VendaMais — exercita o fluxo crítico ponta a ponta
 * contra uma instalação já rodando (local, Preview ou Production).
 *
 *   node scripts/smoke-api.mjs                          # http://127.0.0.1:3000
 *   node scripts/smoke-api.mjs --base=https://<preview>.vercel.app
 *   node scripts/smoke-api.mjs --base=... --keep        # não limpa os dados
 *
 * ⚠️ ESCREVE NO BANCO. Cria um admin efêmero (`vm-smoke-admin@example.com`),
 * uma cotação `[SMOKE] ...` e uma proposta, e **apaga tudo no final** — só o
 * que ele mesmo criou, nunca dado de cliente. Nada disso roda em build ou em
 * qualquer hook automático: é sempre execução manual.
 *
 * Lê as credenciais do `.env.local` (nunca as imprime).
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const BASE = (args.find((a) => a.startsWith("--base="))?.slice(7) ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const KEEP = args.includes("--keep");
const API = `${BASE}/api`;

const env = Object.fromEntries(
  fs
    .readFileSync(path.resolve(".env.local"), "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => /^[A-Z]/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !ANON || !SERVICE) throw new Error("Faltam variáveis do Supabase em .env.local.");

const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

const ADMIN_EMAIL = "vm-smoke-admin@example.com";
const ADMIN_SENHA = "Smoke@2026!";
const TITULO = `[SMOKE] ${new Date().toISOString()}`;

let falhas = 0;
function check(nome, ok, extra = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "✔" : "✘"} ${nome}${extra ? ` — ${extra}` : ""}`);
}

async function rest(pathname, init = {}) {
  const r = await fetch(`${SUPA}/rest/v1${pathname}`, { ...init, headers: { ...svc, ...(init.headers ?? {}) } });
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

/** Admin efêmero — não usa a conta real de ninguém. */
async function criarAdmin() {
  const lista = await (await fetch(`${SUPA}/auth/v1/admin/users?page=1&per_page=200`, { headers: svc })).json();
  let id = lista?.users?.find((u) => u.email === ADMIN_EMAIL)?.id ?? null;

  if (!id) {
    const criado = await (
      await fetch(`${SUPA}/auth/v1/admin/users`, {
        method: "POST",
        headers: svc,
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_SENHA, email_confirm: true }),
      })
    ).json();
    id = criado.id;
    if (!id) throw new Error(`falha ao criar admin: ${JSON.stringify(criado).slice(0, 200)}`);
  }

  const [role] = await rest(`/roles?select=id&key=eq.admin`);
  await rest(`/users`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      id, email: ADMIN_EMAIL, nome: "Smoke Admin", username: "vm-smoke-admin",
      role_id: role.id, must_change_password: false,
    }),
  });
  // cotacoes.admin_id tem FK para a tabela legada `profiles`.
  await rest(`/profiles`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id, role: "admin", nome: "Smoke Admin", email: ADMIN_EMAIL }),
  });

  const login = await (
    await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_SENHA }),
    })
  ).json();
  if (!login.access_token) throw new Error("login do admin de smoke falhou");
  return { id, token: login.access_token };
}

async function limpar(adminId, cotacaoId) {
  if (cotacaoId) {
    const props = await rest(`/propostas?select=id&cotacao_id=eq.${cotacaoId}`);
    const ids = (props ?? []).map((p) => p.id);
    if (ids.length) await rest(`/proposta_itens?proposta_id=in.(${ids.join(",")})`, { method: "DELETE" });
    await rest(`/propostas?cotacao_id=eq.${cotacaoId}`, { method: "DELETE" });
    await rest(`/fornecedores_convidados?cotacao_id=eq.${cotacaoId}`, { method: "DELETE" });
    await rest(`/cotacao_itens?cotacao_id=eq.${cotacaoId}`, { method: "DELETE" });
    await rest(`/cotacoes?id=eq.${cotacaoId}`, { method: "DELETE" });
  }
  if (adminId) {
    await rest(`/users?id=eq.${adminId}`, { method: "DELETE" }).catch(() => {});
    await rest(`/profiles?id=eq.${adminId}`, { method: "DELETE" }).catch(() => {});
    await fetch(`${SUPA}/auth/v1/admin/users/${adminId}`, { method: "DELETE", headers: svc }).catch(() => {});
  }
}

async function main() {
  console.log(`Smoke em ${BASE}\n`);
  const admin = await criarAdmin();
  const H = { Authorization: `Bearer ${admin.token}`, "Content-Type": "application/json" };
  let cotacaoId = null;

  try {
    // ── Sistema / segurança ────────────────────────────────────────────────
    const health = await fetch(`${API}/health`);
    check("GET /api/health", health.status === 200);

    for (const rota of ["/api/fix-profiles", "/api/reload-schema", "/api/debug-profile"]) {
      const r = await fetch(`${BASE}${rota}`, { method: "POST" });
      check(`${rota} removida`, r.status === 404, `status ${r.status}`);
    }

    const semToken = await fetch(`${API}/cotacoes`);
    check("GET /api/cotacoes sem token → 401", semToken.status === 401, `status ${semToken.status}`);

    const tokenRuim = await fetch(`${API}/cotacoes`, { headers: { Authorization: "Bearer abc.def.ghi" } });
    check("GET /api/cotacoes token inválido → 401", tokenRuim.status === 401, `status ${tokenRuim.status}`);

    // ── Empresário: criar + publicar ───────────────────────────────────────
    const criada = await fetch(`${API}/cotacoes/enviar`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        titulo: TITULO,
        itens: [
          { nome_produto: "Smoke Produto A", unidade: "UN", tipo_unidade: "UN", quantidade: 10, quantidade_sugerida: 10, estoque_atual: 3 },
          { nome_produto: "Smoke Produto B", unidade: "CX", tipo_unidade: "CX", quantidade: 4, quantidade_sugerida: 4 },
          { nome_produto: "Smoke Produto C", unidade: "FD", tipo_unidade: "FD", quantidade: 2, quantidade_sugerida: 2 },
        ],
      }),
    });
    const cotacao = await criada.json();
    cotacaoId = cotacao.id;
    check("POST /api/cotacoes/enviar (cria + publica)", criada.status === 201 && cotacao.status === "aberta", `status ${criada.status}/${cotacao.status}`);

    const listagem = await (await fetch(`${API}/cotacoes`, { headers: H })).json();
    check("GET /api/cotacoes lista a nova", Array.isArray(listagem) && listagem.some((c) => c.id === cotacaoId));

    const detalhe = await (await fetch(`${API}/cotacoes/${cotacaoId}`, { headers: H })).json();
    check("GET /api/cotacoes/[id] devolve 3 itens", detalhe.itens?.length === 3, `${detalhe.itens?.length} itens`);
    check("unidade FD preservada na leitura", detalhe.itens?.some((i) => i.tipo_unidade === "FD"));

    // ── Convite ────────────────────────────────────────────────────────────
    const conviteRes = await fetch(`${API}/cotacoes/${cotacaoId}/convites`, {
      method: "POST", headers: H,
      body: JSON.stringify({ whatsapp: "(71) 90000-0002", nome_empresa: "Smoke Distribuidora" }),
    });
    const convite = await conviteRes.json();
    check("POST /api/cotacoes/[id]/convites", conviteRes.status === 201 && !!convite.token_acesso);
    check("e-mail-sentinela não vaza na resposta", convite.email_contato === null, `email_contato=${convite.email_contato}`);

    const convites = await (await fetch(`${API}/cotacoes/${cotacaoId}/convites`, { headers: H })).json();
    check("GET /api/cotacoes/[id]/convites", convites.length === 1);

    // ── Fornecedor (público, via token) ────────────────────────────────────
    const convitePub = await fetch(`${API}/convite/${convite.token_acesso}`);
    const conviteData = await convitePub.json();
    check("GET /api/convite/[token] público", convitePub.status === 200 && conviteData.itens?.length === 3);
    check("convite não expõe quantidade/estoque ao fornecedor", !("quantidade" in (conviteData.itens?.[0] ?? {})) && !("estoque_atual" in (conviteData.itens?.[0] ?? {})));
    check("observacao_geral_suportada = true (migration 023)", conviteData.observacao_geral_suportada === true);

    const itensProposta = conviteData.itens.map((i, idx) => ({
      cotacao_item_id: i.id,
      preco_unitario: idx === 2 ? 0 : 12.5 + idx,
      ...(idx === 0 ? { observacao: "Lote com validade longa." } : {}),
      ...(idx === 2 ? { disponivel: false, observacao: "Sem estoque no momento." } : {}),
    }));

    const envio = await fetch(`${API}/propostas`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token_acesso: convite.token_acesso,
        prazo_entrega: "3 dias úteis",
        observacao: "Pedido mínimo R$ 300. Frete por conta do comprador.",
        nome_empresa: "Smoke Distribuidora",
        itens: itensProposta,
      }),
    });
    const proposta = await envio.json();
    check("POST /api/propostas (envio do fornecedor)", envio.status === 201 && !!proposta.id, `status ${envio.status}`);
    check("observações gerais persistidas", proposta.observacao?.startsWith("Pedido mínimo"), `obs=${proposta.observacao ?? "null"}`);
    check("valor_total = soma(qtd × preço) dos disponíveis", proposta.valor_total === 10 * 12.5 + 4 * 13.5, `valor_total=${proposta.valor_total}`);

    const reenvio = await fetch(`${API}/propostas`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token_acesso: convite.token_acesso, itens: itensProposta }),
    });
    check("reenvio do mesmo convite → 409", reenvio.status === 409, `status ${reenvio.status}`);

    // ── Resultado / ranking ────────────────────────────────────────────────
    const resultado = await (await fetch(`${API}/cotacoes/${cotacaoId}/resultado`, { headers: H })).json();
    const itemA = resultado.itens.find((i) => i.nome_produto === "Smoke Produto A");
    const itemC = resultado.itens.find((i) => i.nome_produto === "Smoke Produto C");
    check("GET /api/cotacoes/[id]/resultado com ranking", itemA?.ranking?.length === 1, `ranking=${itemA?.ranking?.length}`);
    check("observação por item chega no ranking", itemA?.ranking?.[0]?.observacao === "Lote com validade longa.");
    check("observação geral chega no ranking", itemA?.ranking?.[0]?.observacao_proposta?.startsWith("Pedido mínimo"));
    check('"não tenho" fica fora do ranking e em indisponiveis', itemC?.ranking?.length === 0 && itemC?.indisponiveis?.length === 1);

    const propostas = await (await fetch(`${API}/cotacoes/${cotacaoId}/propostas`, { headers: H })).json();
    check("GET /api/cotacoes/[id]/propostas", propostas.length === 1 && propostas[0].itens.length === 3);

    const propDet = await fetch(`${API}/propostas/${proposta.id}`, { headers: H });
    check("GET /api/propostas/[id]", propDet.status === 200);

    // ── Itens / status / grupos ────────────────────────────────────────────
    const patchItem = await fetch(`${API}/cotacoes/${cotacaoId}/itens/${detalhe.itens[0].id}`, {
      method: "PATCH", headers: H, body: JSON.stringify({ quantidade_sugerida: 25 }),
    });
    const itemPatched = await patchItem.json();
    check("PATCH item (quantidade_sugerida)", patchItem.status === 200 && Number(itemPatched.quantidade_sugerida) === 25);

    const grupos = await fetch(`${API}/cotacoes/grupos`, { headers: H });
    check("GET /api/cotacoes/grupos", grupos.status === 200);

    // ── Exportação ─────────────────────────────────────────────────────────
    const xlsx = await fetch(`${API}/cotacoes/${cotacaoId}/export?formato=xlsx&incluir_internos=true`, { headers: H });
    const xbuf = Buffer.from(await xlsx.arrayBuffer());
    const xlsxOk =
      xlsx.status === 200 &&
      xlsx.headers.get("content-type")?.includes("spreadsheetml") &&
      /attachment; filename="cotacao-smoke.*\.xlsx"/.test(xlsx.headers.get("content-disposition") ?? "") &&
      xbuf.subarray(0, 2).toString() === "PK" && // assinatura de zip/xlsx
      xbuf.length > 2000;
    check("GET export xlsx (mime + filename + assinatura PK)", xlsxOk, `${xbuf.length} bytes`);

    const pdf = await fetch(`${API}/cotacoes/${cotacaoId}/export?formato=pdf&incluir_internos=false`, { headers: H });
    const pbuf = Buffer.from(await pdf.arrayBuffer());
    const pdfOk =
      pdf.status === 200 &&
      pdf.headers.get("content-type") === "application/pdf" &&
      pbuf.subarray(0, 5).toString() === "%PDF-" &&
      // pdfkit comprime os streams de conteúdo, então procurar o nome do
      // produto como texto plano no buffer não funciona — o que dá pra
      // afirmar aqui é que o arquivo está íntegro (header + trailer).
      pbuf.includes(Buffer.from("%%EOF")) &&
      pbuf.length > 2000;
    check("GET export pdf (mime + %PDF- + %%EOF)", pdfOk, `${pbuf.length} bytes`);

    // ── Aceitar proposta (fecha a cotação) ─────────────────────────────────
    const aceite = await fetch(`${API}/propostas/${proposta.id}`, {
      method: "PATCH", headers: H, body: JSON.stringify({ status: "aceita" }),
    });
    const aceita = await aceite.json();
    check("PATCH /api/propostas/[id] aceitar", aceite.status === 200 && aceita.status === "aceita");

    const depois = await (await fetch(`${API}/cotacoes/${cotacaoId}`, { headers: H })).json();
    check("cotação fecha ao aceitar", depois.cotacao.status === "fechada", `status=${depois.cotacao.status}`);

    // ── Autorização horizontal (IDOR) ──────────────────────────────────────
    const outra = await rest(`/cotacoes?select=id&admin_id=neq.${admin.id}&limit=1`);
    if (outra?.[0]) {
      const idor = await fetch(`${API}/cotacoes/${outra[0].id}`, { headers: H });
      check("IDOR: cotação de outro dono → 403", idor.status === 403, `status ${idor.status}`);
      const idorDel = await fetch(`${API}/cotacoes/${outra[0].id}`, { method: "DELETE", headers: H });
      check("IDOR: DELETE de outro dono → 403", idorDel.status === 403, `status ${idorDel.status}`);
    }

    // ── Exclusão ───────────────────────────────────────────────────────────
    const del = await fetch(`${API}/cotacoes/${cotacaoId}`, { method: "DELETE", headers: H });
    check("DELETE /api/cotacoes/[id] (mesmo fechada)", del.status === 200, `status ${del.status}`);
    const sumiu = await fetch(`${API}/cotacoes/${cotacaoId}`, { headers: H });
    check("cotação excluída → 404", sumiu.status === 404, `status ${sumiu.status}`);
    if (del.status === 200) cotacaoId = null;
  } finally {
    if (!KEEP) await limpar(admin.id, cotacaoId);
    else console.log(`\n(--keep: admin ${ADMIN_EMAIL} e cotação ${cotacaoId} mantidos)`);
  }

  console.log(`\n${falhas === 0 ? "✅ smoke OK" : `❌ ${falhas} verificação(ões) falharam`}`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exit(1);
});
