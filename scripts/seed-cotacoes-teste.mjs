#!/usr/bin/env node
/*
 * Massa de teste do fluxo de cotação: 20 fornecedores fictícios + listas de
 * cotação montadas com os produtos já cadastrados (ver
 * seed-produtos-cosmeticos.mjs), cada uma com 20 a 30 itens, convites e
 * propostas respondidas — o suficiente pra tela de comparação ter ranking,
 * observação por item e "não tenho" de verdade.
 *
 * Uso:
 *   node scripts/seed-cotacoes-teste.mjs            # cria
 *   node scripts/seed-cotacoes-teste.mjs --dry-run  # só mostra o plano
 *   node scripts/seed-cotacoes-teste.mjs --undo     # remove o que criou
 *
 * Idempotente: usuário já existente (mesmo e-mail) e cotação já existente
 * (mesmo título) são pulados, então rodar duas vezes não duplica.
 *
 * Escreve com a service role key: `products` e `users` são RLS-locked (ver
 * CLAUDE.md, gotchas #21 e #31) e `users.id` referencia `auth.users`, então os
 * fornecedores precisam ser criados pela Admin API do Auth antes da linha em
 * `users` — é o mesmo caminho de `createUserWithProvisionalPassword`.
 *
 * Sementes fixas (PRNG determinístico): rodar de novo gera os mesmos preços,
 * o que torna o resultado da comparação reproduzível entre máquinas.
 */
import fs from "node:fs";
import path from "node:path";

// ─── Marcadores ──────────────────────────────────────────────────────────────
// Tudo que este script cria carrega um destes prefixos — é por eles que o
// --undo encontra o que apagar, sem tocar em dado real.
const EMAIL_DOMINIO = "example.com"; // RFC 2606: reservado, nunca entregável
const EMAIL_PREFIXO = "vm-teste-";
const TITULO_PREFIXO = "[TESTE]";
const SENHA_PROVISORIA = "VendaMais@2026";

// ─── Fornecedores fictícios ──────────────────────────────────────────────────
// [nome do contato, empresa, DDD, número]
const FORNECEDORES = [
  ["Adriana Bastos", "Distribuidora Bela Vista Cosméticos", "11", "982340011"],
  ["Bruno Carvalho", "Atacado Aurora Beauty", "11", "982340012"],
  ["Camila Rezende", "Nova Essência Distribuidora", "21", "982340013"],
  ["Diego Fontana", "Fontana & Cia Perfumaria", "21", "982340014"],
  ["Elaine Moraes", "Prisma Cosméticos Atacado", "31", "982340015"],
  ["Fábio Tavares", "Tavares Beauty Supply", "31", "982340016"],
  ["Gabriela Nunes", "Brilho Real Distribuidora", "41", "982340017"],
  ["Henrique Peixoto", "Peixoto Higiene e Beleza", "41", "982340018"],
  ["Isabela Cordeiro", "Cordeiro Import Cosméticos", "51", "982340019"],
  ["João Marcelo Dutra", "Dutra Atacadista de Beleza", "51", "982340020"],
  ["Karina Lobo", "Lobo Distribuição Premium", "61", "982340021"],
  ["Leonardo Amaral", "Amaral Beauty Group", "61", "982340022"],
  ["Marina Sampaio", "Sampaio Cosmetics do Brasil", "71", "982340023"],
  ["Nelson Queiroz", "Queiroz Atacado Bahia", "71", "982340024"],
  ["Otávio Prado", "Prado Beleza Distribuidora", "81", "982340025"],
  ["Patrícia Villela", "Villela Higiene Profissional", "81", "982340026"],
  ["Rafael Bittencourt", "Bittencourt Supply Beauty", "85", "982340027"],
  ["Simone Andrade", "Andrade Cosméticos Nordeste", "85", "982340028"],
  ["Thiago Marcondes", "Marcondes Distribuição SA", "48", "982340029"],
  ["Vanessa Klein", "Klein Beauty Partners", "48", "982340030"],
];

// ─── Listas de cotação ───────────────────────────────────────────────────────
// `categorias` escolhe de onde vêm os produtos (a cotação fica parecida com
// uma compra real de reposição, não uma amostra aleatória do catálogo).
const LISTAS = [
  {
    titulo: `${TITULO_PREFIXO} Reposição Semanal — Cabelos`,
    categorias: ["Cabelos"],
    itens: 28,
    status: "aberta",
    diasLimite: 5,
    fornecedores: 7,
    // Convidados que ainda não responderam — a tela precisa distinguir
    // "não cotou" de "respondeu que não tem".
    convidadosSemResposta: 2,
  },
  {
    titulo: `${TITULO_PREFIXO} Compra Mensal — Pele e Rosto`,
    categorias: ["Pele e Rosto", "Proteção Solar"],
    itens: 25,
    status: "aberta",
    diasLimite: 8,
    fornecedores: 5,
    convidadosSemResposta: 3,
  },
  {
    titulo: `${TITULO_PREFIXO} Verão — Corpo, Banho e Desodorantes`,
    categorias: ["Corpo e Banho", "Desodorantes"],
    itens: 30,
    status: "fechada",
    diasLimite: -3,
    fornecedores: 6,
    convidadosSemResposta: 1,
  },
  {
    titulo: `${TITULO_PREFIXO} Perfumaria e Maquiagem — Dia das Mães`,
    categorias: ["Perfumaria", "Maquiagem"],
    itens: 26,
    status: "fechada",
    diasLimite: -10,
    fornecedores: 4,
    convidadosSemResposta: 2,
  },
  {
    titulo: `${TITULO_PREFIXO} Rascunho — Higiene Bucal e Barba`,
    categorias: ["Higiene Bucal", "Barba e Masculino"],
    itens: 22,
    status: "rascunho",
    diasLimite: 15,
    fornecedores: 0,
    convidadosSemResposta: 0,
  },
];

/** Observações que o fornecedor escreve por item — é o texto que o acesso
 * rápido do item mostra ao lado do preço. */
const OBS_DISPONIVEL = [
  "Preço válido para retirada no CD. Entrega tem frete à parte.",
  "Só fecho nessa condição a partir de 3 caixas.",
  "Lote com validade 08/2027.",
  "Consigo melhorar 3% se levar junto com os outros itens da lista.",
  "Estoque limitado — tenho 40 unidades disponíveis agora.",
  "Preço promocional até sexta.",
  "Produto em caixa fechada com 12 unidades.",
  "Última compra sua foi nesse mesmo valor.",
  "Tenho a versão 400ml também, se interessar posso cotar.",
  "Pagamento em 28 dias mantém esse preço.",
];

const OBS_INDISPONIVEL = [
  "Sem estoque, previsão de chegada dia 20.",
  "Fabricante descontinuou essa apresentação.",
  "Não trabalho com essa marca.",
  "Em falta na indústria, sem previsão.",
  "Só consigo no pedido do mês que vem.",
];

const PRAZOS = [
  "2 dias úteis",
  "3 dias úteis",
  "5 dias úteis",
  "7 dias úteis",
  "Entrega imediata para pedidos até 12h",
  "10 dias úteis",
];

const TIPOS_UNIDADE = ["UN", "CX", "DZ"]; // 'FD' fica de fora: a constraint do
// banco real ainda recusa (ver o alerta no topo do CLAUDE.md). O backend
// contorna no insert dele; aqui o insert é direto e quebraria.

// ─── Infra ───────────────────────────────────────────────────────────────────

function loadEnv() {
  const file = path.resolve(".env.local");
  if (!fs.existsSync(file)) {
    throw new Error("`.env.local` não encontrado — rode a partir da raiz do projeto.");
  }
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .replace(/\r/g, "")
      .split("\n")
      .filter((line) => /^[A-Z]/.test(line))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.");
}

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function rest(pathname, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${pathname}`, {
    ...init,
    headers: { ...HEADERS, ...(init.headers ?? {}) },
  });
  const body = await res.text();
  const parsed = body ? JSON.parse(body) : null;
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${pathname} → ${res.status} ${body}`);
  }
  return parsed;
}

async function auth(pathname, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${pathname}`, {
    ...init,
    headers: { ...HEADERS, ...(init.headers ?? {}) },
  });
  const body = await res.text();
  const parsed = body ? JSON.parse(body) : null;
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} auth${pathname} → ${res.status} ${body}`);
  }
  return parsed;
}

/** PRNG determinístico (mulberry32) — mesma semente, mesmos preços. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const inteiro = (r, min, max) => min + Math.floor(r() * (max - min + 1));
const escolher = (r, arr) => arr[Math.floor(r() * arr.length)];
const round2 = (n) => Math.round(n * 100) / 100;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function slugify(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function emailDoFornecedor(indice) {
  return `${EMAIL_PREFIXO}${String(indice + 1).padStart(2, "0")}@${EMAIL_DOMINIO}`;
}

/** Forma canônica gravada em `fornecedores_convidados.whatsapp` — 55 + DDD +
 * número, só dígitos (espelha normalizarWhatsapp do backend). */
function whatsappCanonico(ddd, numero) {
  return `55${ddd}${numero}`;
}

const dias = (n) => new Date(Date.now() + n * 86_400_000).toISOString();

// ─── Execução ────────────────────────────────────────────────────────────────

const dryRun = process.argv.includes("--dry-run");
const undo = process.argv.includes("--undo");

async function resolverAdmin() {
  const [role] = await rest(`/roles?select=id&key=eq.admin`);
  if (!role) throw new Error("Role 'admin' não encontrada.");
  const admins = await rest(
    `/users?select=id,nome,email&role_id=eq.${role.id}&deleted_at=is.null&order=created_at.asc`,
  );
  if (admins.length === 0) {
    throw new Error("Nenhum usuário admin encontrado — as cotações precisam de um dono.");
  }
  return { admin: admins[0], adminRoleId: role.id };
}

async function desfazer() {
  // 1) Cotações (e tudo que pende delas). Ordem importa: proposta_itens →
  // propostas → convites → itens → cotação.
  const cotacoes = await rest(
    `/cotacoes?select=id,titulo&titulo=like.${encodeURIComponent(`${TITULO_PREFIXO}%`)}`,
  );

  for (const cotacao of cotacoes) {
    const propostas = await rest(`/propostas?select=id&cotacao_id=eq.${cotacao.id}`);
    for (const lote of chunk(propostas.map((p) => p.id), 40)) {
      await rest(`/proposta_itens?proposta_id=in.(${lote.join(",")})`, { method: "DELETE" });
    }
    await rest(`/propostas?cotacao_id=eq.${cotacao.id}`, { method: "DELETE" });
    await rest(`/fornecedores_convidados?cotacao_id=eq.${cotacao.id}`, { method: "DELETE" });
    await rest(`/cotacao_itens?cotacao_id=eq.${cotacao.id}`, { method: "DELETE" });
    await rest(`/cotacoes?id=eq.${cotacao.id}`, { method: "DELETE" });
  }
  console.log(`Cotações removidas: ${cotacoes.length}`);

  // 2) Fornecedores. A linha em `users` cai por ON DELETE CASCADE quando o
  // usuário do Auth é apagado, mas apagamos as duas por segurança (a cascade
  // depende da FK criada na migration 009 estar de fato no banco).
  const emails = FORNECEDORES.map((_, i) => emailDoFornecedor(i));
  const usuarios = await rest(
    `/users?select=id,email&email=in.(${emails.map((e) => `"${e}"`).join(",")})`,
  );
  for (const u of usuarios) {
    await auth(`/admin/users/${u.id}`, { method: "DELETE" });
    await rest(`/users?id=eq.${u.id}`, { method: "DELETE" }).catch(() => {});
  }
  console.log(`Fornecedores removidos: ${usuarios.length}`);
}

async function criarFornecedores(segmentoId) {
  const [roleFornecedor] = await rest(`/roles?select=id&key=eq.supplier`);
  if (!roleFornecedor) throw new Error("Role 'supplier' não encontrada.");

  const emails = FORNECEDORES.map((_, i) => emailDoFornecedor(i));
  const existentes = await rest(
    `/users?select=id,email,nome,organization_name,whatsapp&email=in.(${emails
      .map((e) => `"${e}"`)
      .join(",")})`,
  );
  const porEmail = new Map(existentes.map((u) => [u.email, u]));

  const criados = [];
  for (const [i, [nome, empresa, ddd, numero]] of FORNECEDORES.entries()) {
    const email = emailDoFornecedor(i);
    const jaExiste = porEmail.get(email);
    if (jaExiste) {
      criados.push(jaExiste);
      continue;
    }

    const authUser = await auth(`/admin/users`, {
      method: "POST",
      body: JSON.stringify({
        email,
        password: SENHA_PROVISORIA,
        email_confirm: true,
        user_metadata: { nome, role: "supplier" },
      }),
    });

    const whatsapp = whatsappCanonico(ddd, numero);
    // Upsert: o trigger de auth pode ter criado a linha antes de chegarmos aqui.
    const [linha] = await rest(`/users`, {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        id: authUser.id,
        email,
        nome,
        username: slugify(email.split("@")[0]),
        role_id: roleFornecedor.id,
        organization_name: empresa,
        segmento_id: segmentoId,
        whatsapp,
        must_change_password: false,
      }),
    });

    criados.push(linha);
    process.stdout.write(`  fornecedores ${criados.length}/${FORNECEDORES.length}\r`);
  }

  console.log(`\nFornecedores prontos: ${criados.length} (${existentes.length} já existiam)`);
  return criados;
}

async function carregarProdutos() {
  const produtos = await rest(
    `/products?select=id,name,category,price_unit_store,barcode,description&deleted_at=is.null&price_unit_store=gt.0&limit=2000`,
  );
  const porCategoria = new Map();
  for (const p of produtos) {
    const chave = p.category ?? "(sem categoria)";
    if (!porCategoria.has(chave)) porCategoria.set(chave, []);
    porCategoria.get(chave).push(p);
  }
  return { produtos, porCategoria };
}

/** Escolhe `quantos` produtos das categorias pedidas, sem repetir; completa
 * com o catálogo inteiro se as categorias não tiverem itens suficientes. */
function selecionarProdutos(lista, porCategoria, todos, r) {
  const candidatos = lista.categorias.flatMap((c) => porCategoria.get(c) ?? []);
  const pool = candidatos.length >= lista.itens ? [...candidatos] : [...todos];

  const escolhidos = [];
  const usados = new Set();
  while (escolhidos.length < lista.itens && usados.size < pool.length) {
    const idx = Math.floor(r() * pool.length);
    if (usados.has(idx)) continue;
    usados.add(idx);
    escolhidos.push(pool[idx]);
  }
  return escolhidos;
}

async function criarLista(lista, produtosSelecionados, fornecedoresDaLista, adminId, r) {
  const ehRascunho = lista.status === "rascunho";

  const [cotacao] = await rest(`/cotacoes`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      admin_id: adminId,
      titulo: lista.titulo,
      status: lista.status,
      data_abertura: ehRascunho ? null : dias(-2),
      data_fechamento: lista.status === "fechada" ? dias(-1) : null,
      data_limite: dias(lista.diasLimite),
    }),
  });

  const itensPayload = produtosSelecionados.map((p) => {
    const tipo = escolher(r, TIPOS_UNIDADE);
    const quantidade = inteiro(r, 6, 60);
    return {
      cotacao_id: cotacao.id,
      nome_produto: p.name,
      unidade: tipo,
      tipo_unidade: tipo,
      quantidade,
      estoque_atual: inteiro(r, 0, 25),
      // Sugestão é a quantidade que o comprador pretende comprar de fato —
      // é ela que multiplica o preço ofertado nos subtotais da comparação.
      quantidade_sugerida: quantidade,
      codigo_barras: p.barcode,
      categoria: p.category,
      product_id: p.id,
      descricao: p.description,
      observacao: r() < 0.15 ? "Confirmar validade mínima de 12 meses." : null,
    };
  });

  const itens = await rest(`/cotacao_itens`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(itensPayload),
  });

  if (ehRascunho) return { cotacao, itens: itens.length, convites: 0, propostas: 0 };

  // ── Convites ──────────────────────────────────────────────────────────────
  const totalConvidados = lista.fornecedores + lista.convidadosSemResposta;
  const convidados = fornecedoresDaLista.slice(0, totalConvidados);
  const convites = await rest(`/fornecedores_convidados`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(
      convidados.map((f, i) => ({
        cotacao_id: cotacao.id,
        email_contato: f.email,
        whatsapp: f.whatsapp,
        nome_empresa: f.organization_name,
        status_convite:
          i < lista.fornecedores ? "respondido" : i % 2 === 0 ? "visualizado" : "pendente",
      })),
    ),
  });

  // ── Propostas ─────────────────────────────────────────────────────────────
  const precoPorNome = new Map(produtosSelecionados.map((p) => [p.name, p.price_unit_store]));
  const respondentes = convites.slice(0, lista.fornecedores);
  let totalItensProposta = 0;

  for (const [indice, convite] of respondentes.entries()) {
    // Viés por fornecedor: um é caro em tudo, outro é barato — sem isso o
    // ranking fica embaralhado demais pra reconhecer padrão na tela.
    const vies = 0.62 + indice * 0.055;

    const itensDaProposta = itens
      // ~12% dos itens ficam sem resposta ("não cotou", diferente de "não tem").
      .filter(() => r() > 0.12)
      .map((item) => {
        const precoLoja = precoPorNome.get(item.nome_produto) ?? 10;
        const disponivel = r() > 0.08;
        const fator = vies + (r() - 0.5) * 0.18;
        return {
          item,
          disponivel,
          preco_unitario: disponivel ? round2(precoLoja * fator) : 0,
          observacao: disponivel
            ? r() < 0.3
              ? escolher(r, OBS_DISPONIVEL)
              : null
            : escolher(r, OBS_INDISPONIVEL),
        };
      });

    const valorTotal = round2(
      itensDaProposta.reduce(
        (soma, i) => (i.disponivel ? soma + i.item.quantidade * i.preco_unitario : soma),
        0,
      ),
    );

    const [proposta] = await rest(`/propostas`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        cotacao_id: cotacao.id,
        fornecedor_convidado_id: convite.id,
        status: "enviada",
        valor_total: valorTotal,
        prazo_entrega: escolher(r, PRAZOS),
      }),
    });

    for (const lote of chunk(itensDaProposta, 100)) {
      await rest(`/proposta_itens`, {
        method: "POST",
        body: JSON.stringify(
          lote.map((i) => ({
            proposta_id: proposta.id,
            // `produto_nome` é o texto congelado no envio — é por ele que o
            // ranking casa item da cotação com item da proposta (não há FK).
            produto_nome: i.item.nome_produto,
            quantidade: i.item.quantidade,
            preco_unitario: i.preco_unitario,
            observacao: i.observacao,
            disponivel: i.disponivel,
          })),
        ),
      });
    }

    totalItensProposta += itensDaProposta.length;
  }

  return {
    cotacao,
    itens: itens.length,
    convites: convites.length,
    propostas: respondentes.length,
    itensProposta: totalItensProposta,
  };
}

async function main() {
  if (undo) {
    await desfazer();
    return;
  }

  const { admin } = await resolverAdmin();
  console.log(`Dono das cotações: ${admin.nome} <${admin.email}>`);

  const { produtos, porCategoria } = await carregarProdutos();
  console.log(`Catálogo disponível: ${produtos.length} produtos com preço de loja.`);

  if (produtos.length === 0) {
    throw new Error(
      "Nenhum produto com preço cadastrado — rode antes `node scripts/seed-produtos-cosmeticos.mjs`.",
    );
  }

  const existentes = await rest(
    `/cotacoes?select=id,titulo&titulo=like.${encodeURIComponent(`${TITULO_PREFIXO}%`)}`,
  );
  const jaCriadas = new Set(existentes.map((c) => c.titulo));
  const pendentes = LISTAS.filter((l) => !jaCriadas.has(l.titulo));

  if (dryRun) {
    console.log("\n--dry-run: nada foi gravado.\n");
    console.log(`Fornecedores a criar: ${FORNECEDORES.length} (${EMAIL_PREFIXO}NN@${EMAIL_DOMINIO})`);
    for (const [nome, empresa] of FORNECEDORES.slice(0, 5)) {
      console.log(`  · ${nome} — ${empresa}`);
    }
    console.log(`  … e mais ${FORNECEDORES.length - 5}\n`);
    console.log(`Listas a criar: ${pendentes.length} de ${LISTAS.length}`);
    const r = rng(20260815);
    for (const lista of LISTAS) {
      const selecao = selecionarProdutos(lista, porCategoria, produtos, r);
      const marca = jaCriadas.has(lista.titulo) ? "(já existe, seria pulada)" : "";
      console.log(
        `  · ${lista.titulo} — ${selecao.length} itens, status ${lista.status}, ` +
          `${lista.fornecedores} propostas ${marca}`,
      );
    }
    return;
  }

  const [segmento] = await rest(`/segmentos?select=id&slug=eq.cosmeticos`);
  const fornecedores = await criarFornecedores(segmento?.id ?? null);

  if (pendentes.length === 0) {
    console.log("Todas as listas já existem — nada a criar.");
    return;
  }

  // Semente fixa: os mesmos preços a cada execução, resultado reproduzível.
  const r = rng(20260815);
  for (const [i, lista] of LISTAS.entries()) {
    if (jaCriadas.has(lista.titulo)) {
      // Consome a mesma sequência do PRNG, pra que pular uma lista não mude os
      // preços das seguintes.
      selecionarProdutos(lista, porCategoria, produtos, r);
      console.log(`· ${lista.titulo} — já existe, pulada.`);
      continue;
    }

    const selecao = selecionarProdutos(lista, porCategoria, produtos, r);
    // Rotaciona quem é convidado, pra que nem toda cotação tenha os mesmos
    // fornecedores no ranking.
    const rodada = [...fornecedores.slice(i * 3), ...fornecedores.slice(0, i * 3)];
    const resumo = await criarLista(lista, selecao, rodada, admin.id, r);

    console.log(
      `· ${lista.titulo} — ${resumo.itens} itens, ${resumo.convites} convites, ` +
        `${resumo.propostas} propostas (${resumo.itensProposta ?? 0} itens cotados)`,
    );
  }

  console.log(
    `\nPronto. Senha dos fornecedores de teste: ${SENHA_PROVISORIA} ` +
      `(login por ${EMAIL_PREFIXO}NN@${EMAIL_DOMINIO}).`,
  );
}

main().catch((err) => {
  console.error("\nFalhou:", err.message);
  process.exit(1);
});
