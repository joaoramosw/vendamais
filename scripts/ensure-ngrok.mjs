#!/usr/bin/env node
/*
 * Auto-configura o ngrok no ambiente antes do build (hook "prebuild").
 *
 * 1. Se o binário `ngrok` não existir, instala globalmente via npm
 *    (mesmo mecanismo já usado nesta máquina: npm i -g ngrok).
 * 2. Se NGROK_AUTHTOKEN estiver definido (env ou .env.local), roda
 *    `ngrok config add-authtoken` para garantir a config do túnel.
 * 3. Sem token configurado, apenas avisa — nunca quebra o build.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(".env.local"), quiet: true });

const shell = process.platform === "win32";
const log = (msg) => console.log(`[ensure-ngrok] ${msg}`);
const warn = (msg) => console.warn(`[ensure-ngrok] AVISO: ${msg}`);

function run(cmd, args) {
  const res = spawnSync(cmd, args, { shell, stdio: "inherit" });
  return res.status;
}

function isInstalled() {
  const probe = spawnSync("ngrok", ["version"], {
    shell,
    encoding: "utf-8",
  });
  return probe.status === 0;
}

function hasTokenConfigured() {
  const probe = spawnSync("ngrok", ["config", "check"], {
    shell,
    encoding: "utf-8",
  });
  return probe.status === 0;
}

try {
  if (!isInstalled()) {
    log("ngrok não encontrado. Instalando globalmente via npm...");
    const status = run("npm", ["install", "-g", "ngrok"]);
    if (status !== 0) {
      warn("Falha ao instalar o ngrok. Você pode instalá-lo manualmente com: npm install -g ngrok");
    } else {
      log("ngrok instalado com sucesso.");
    }
  } else {
    log("ngrok já está instalado.");
  }

  const token = process.env.NGROK_AUTHTOKEN?.trim();

  if (token) {
    log("Configurando authtoken do ngrok...");
    const status = run("ngrok", ["config", "add-authtoken", token]);
    if (status !== 0) {
      warn("Falha ao configurar o authtoken do ngrok.");
    } else {
      log("Authtoken configurado.");
    }
  } else if (hasTokenConfigured()) {
    log("Authtoken do ngrok já configurado.");
  } else {
    warn(
      "Nenhum authtoken encontrado. Para testar no celular via ngrok, crie sua conta " +
        "(https://ngrok.com) e defina NGROK_AUTHTOKEN em .env.local."
    );
  }
} catch (err) {
  warn(`Falha inesperada: ${err instanceof Error ? err.message : err}`);
}

process.exit(0);
