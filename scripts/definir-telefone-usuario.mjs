#!/usr/bin/env node
/*
 * Define (ou corrige) o **telefone de login** de uma conta existente.
 *
 * Por que existe: depois da migração para autenticação por telefone, nenhuma
 * tela de auth pede e-mail — quem entra, entra pelo número. Contas criadas
 * antes disso têm `users.whatsapp` vazio e ficariam sem porta de entrada. Este
 * script é a única forma de destravar a primeira delas (tipicamente a conta do
 * administrador); a partir daí, os demais usuários se resolvem pela tela
 * /empresario/usuarios.
 *
 * O e-mail do Auth **não** é alterado: o login resolve `telefone → users.email
 * → Supabase Auth` (ver src/lib/auth/phone-auth.ts#signInWithPhone), então a
 * conta legada continua com o e-mail real com que foi criada e passa a entrar
 * pelo número. A senha também não muda.
 *
 * Uso (a partir da raiz do projeto):
 *   node scripts/definir-telefone-usuario.mjs --email joao@empresa.com --telefone "(71) 99999-9999"
 *   node scripts/definir-telefone-usuario.mjs --id <uuid> --telefone 71999999999
 *   node scripts/definir-telefone-usuario.mjs --listar        # mostra quem está sem telefone
 *   ... --dry-run                                             # só mostra o que faria
 *
 * Escreve com a service role key: `users` é RLS-locked (ver CLAUDE.md).
 */
import fs from "node:fs";
import path from "node:path";

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

// ─── Telefone ────────────────────────────────────────────────────────────────
// Mesma regra de src/lib/phone.ts#normalizePhone (duplicada aqui porque o
// script roda sem o bundler/alias do Next). Se mudar lá, mude aqui.

function normalizePhone(input) {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  throw new Error(
    `Telefone inválido: "${input}". Use DDD + número (ex.: (71) 99999-9999).`,
  );
}

function formatPhoneBR(digits) {
  if (!digits) return "—";
  const resto = digits.slice(4);
  const prefixo = resto.length === 9 ? resto.slice(0, 5) : resto.slice(0, 4);
  const sufixo = resto.length === 9 ? resto.slice(5) : resto.slice(4);
  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${prefixo}-${sufixo}`;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { dryRun: false, listar: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--listar") args.listar = true;
    else if (arg === "--email") args.email = argv[++i];
    else if (arg === "--id") args.id = argv[++i];
    else if (arg === "--telefone") args.telefone = argv[++i];
  }
  return args;
}

async function listarSemTelefone() {
  const users = await rest(
    "/users?select=id,nome,email,whatsapp,roles(key)&deleted_at=is.null&order=created_at.asc",
  );

  const semTelefone = users.filter((u) => !u.whatsapp);

  console.log(`\n${users.length} conta(s) ativa(s); ${semTelefone.length} sem telefone.\n`);
  for (const u of users) {
    const papel = u.roles?.key ?? "?";
    const marca = u.whatsapp ? "  " : "⚠ ";
    console.log(
      `${marca}${(u.nome ?? "—").padEnd(28)} ${papel.padEnd(9)} ${formatPhoneBR(u.whatsapp).padEnd(22)} ${u.email}`,
    );
  }
  if (semTelefone.length > 0) {
    console.log(
      "\nAs marcadas com ⚠ não conseguem fazer login (nenhuma tela de auth pede e-mail).",
    );
    console.log(
      'Corrija com: node scripts/definir-telefone-usuario.mjs --email <e-mail> --telefone "(71) 99999-9999"\n',
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.listar) {
    await listarSemTelefone();
    return;
  }

  if (!args.telefone || (!args.email && !args.id)) {
    console.error(
      "Uso: node scripts/definir-telefone-usuario.mjs --email <e-mail>|--id <uuid> --telefone <numero> [--dry-run]\n" +
        "     node scripts/definir-telefone-usuario.mjs --listar",
    );
    process.exitCode = 1;
    return;
  }

  const telefone = normalizePhone(args.telefone);

  const filtro = args.id
    ? `id=eq.${args.id}`
    : `email=eq.${encodeURIComponent(String(args.email).toLowerCase())}`;
  const [alvo] = await rest(`/users?select=id,nome,email,whatsapp&${filtro}&deleted_at=is.null`);

  if (!alvo) {
    console.error("Usuário não encontrado (ou já excluído).");
    process.exitCode = 1;
    return;
  }

  // O índice único da migration 022 barraria isso no banco; checar antes dá
  // uma mensagem melhor do que o erro cru do Postgres.
  const conflito = await rest(
    `/users?select=id,nome&whatsapp=eq.${telefone}&deleted_at=is.null&id=neq.${alvo.id}`,
  );
  if (conflito.length > 0) {
    console.error(
      `Este telefone já pertence a outra conta (${conflito[0].nome}). Um número, uma conta.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Conta:    ${alvo.nome} <${alvo.email}>`);
  console.log(`Telefone: ${formatPhoneBR(alvo.whatsapp)}  →  ${formatPhoneBR(telefone)}`);

  if (args.dryRun) {
    console.log("\n--dry-run: nada foi alterado.");
    return;
  }

  await rest(`/users?id=eq.${alvo.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ whatsapp: telefone }),
  });

  console.log(`\n✓ Pronto. A conta agora entra em /login com ${formatPhoneBR(telefone)} + a senha atual.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
