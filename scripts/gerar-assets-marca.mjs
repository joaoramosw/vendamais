#!/usr/bin/env node
/*
 * Gera os arquivos de marca usados pelo site a partir dos originais entregues
 * pelo design (`public/logos/`).
 *
 * Duas peças entram no produto (decisão de marca):
 *   - o **símbolo** (`favicon vendamais.png`) — ícone branco sobre o índigo da
 *     marca, quadrado. Compacto, funciona sobre qualquer fundo — usado em
 *     espaço apertado (sidebar, ícones) e é a base do favicon;
 *   - o **lockup** (símbolo + "Venda+" por extenso) — usado em espaço largo
 *     (cabeçalhos, telas de auth). Tem duas versões, uma por esquema de cor,
 *     porque o texto é sólido (sem contorno) e precisa do contraste certo:
 *     `vendmais escuro logo fundo claro.png` (texto escuro, pro tema claro) e
 *     `vendamais_em_branco-removebg-preview.png` (texto branco, pro tema
 *     escuro e pra qualquer superfície com fundo escuro fixo).
 * O logo vertical fica no repositório como fonte, sem tela que o referencie.
 *
 * O que este script faz (idempotente — rode de novo depois de trocar algum
 * original):
 *   1. corta o excesso de área transparente dos lockups (o original tem ~11%
 *      de margem lateral e ~27% vertical, o que fazia o logo parecer pequeno
 *      e desalinhado dentro da própria caixa);
 *   2. redimensiona pros tamanhos usados no site e recomprime;
 *   3. gera `src/app/icon.png` e `src/app/apple-icon.png`, que o Next serve
 *      como favicon/ícone de app pelo metadata baseado em arquivo — sem
 *      nenhuma configuração no código.
 *
 * Uso: node scripts/gerar-assets-marca.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ORIGEM_SIMBOLO = "public/logos/favicon vendamais.png";
const ORIGEM_LOCKUP_ESCURO = "public/logos/vendmais escuro logo fundo claro.png";
const ORIGEM_LOCKUP_BRANCO = "public/logos/vendamais_em_branco-removebg-preview.png";

const dryRun = process.argv.includes("--dry-run");

/** Maior uso do símbolo é ~48px; 256 dá folga e serve de base pros ícones. */
const LADO_SIMBOLO = 256;
/** Maior uso do lockup na tela é ~320px de largura (coluna do /login) — 2x
 * cobre telas retina sem carregar o original (2172px) à toa. */
const LARGURA_LOCKUP = 640;

const saidas = [
  {
    de: ORIGEM_SIMBOLO,
    para: "public/logos/vendamais-simbolo.png",
    descricao: "símbolo quadrado (qualquer fundo, espaço apertado)",
    transformar: (img) => img.resize(LADO_SIMBOLO, LADO_SIMBOLO),
  },
  {
    de: ORIGEM_LOCKUP_ESCURO,
    para: "public/logos/vendamais-logo-escuro.png",
    descricao: "lockup texto escuro (tema claro)",
    transformar: (img) => img.trim({ threshold: 1 }).resize({ width: LARGURA_LOCKUP }),
  },
  {
    de: ORIGEM_LOCKUP_BRANCO,
    para: "public/logos/vendamais-logo-branco.png",
    descricao: "lockup texto branco (tema escuro / fundo escuro fixo)",
    transformar: (img) => img.trim({ threshold: 1 }).resize({ width: LARGURA_LOCKUP }),
  },
  {
    de: ORIGEM_SIMBOLO,
    para: "src/app/icon.png",
    descricao: "favicon (metadata por arquivo do Next)",
    transformar: (img) => img.resize(64, 64),
  },
  {
    de: ORIGEM_SIMBOLO,
    para: "src/app/apple-icon.png",
    descricao: "ícone de app iOS (180x180, exigido pela Apple)",
    transformar: (img) => img.resize(180, 180),
  },
];

/**
 * Monta um `.ico` com várias resoluções embutindo PNGs (formato suportado
 * desde o Windows Vista e por todos os navegadores atuais). O sharp não
 * escreve ICO, e o container é simples o bastante para montar aqui:
 * cabeçalho de 6 bytes + uma entrada de 16 bytes por tamanho + os PNGs.
 *
 * Existe porque `src/app/favicon.ico` vinha do `create-next-app` (o ícone do
 * Next) e tem precedência sobre o `icon.png` na maioria dos navegadores —
 * deixá-lo para trás manteria o logo errado na aba.
 */
async function montarIco(origem, tamanhos) {
  const pngs = await Promise.all(
    tamanhos.map((lado) =>
      sharp(origem).resize(lado, lado).png({ compressionLevel: 9 }).toBuffer(),
    ),
  );

  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0); // reservado
  cabecalho.writeUInt16LE(1, 2); // 1 = ícone
  cabecalho.writeUInt16LE(tamanhos.length, 4);

  const entradas = Buffer.alloc(16 * tamanhos.length);
  let offset = cabecalho.length + entradas.length;

  tamanhos.forEach((lado, i) => {
    const base = i * 16;
    // 0 no byte de largura/altura significa 256 no formato ICO.
    entradas.writeUInt8(lado >= 256 ? 0 : lado, base);
    entradas.writeUInt8(lado >= 256 ? 0 : lado, base + 1);
    entradas.writeUInt8(0, base + 2); // paleta (0 = truecolor)
    entradas.writeUInt8(0, base + 3); // reservado
    entradas.writeUInt16LE(1, base + 4); // planos
    entradas.writeUInt16LE(32, base + 6); // bits por pixel
    entradas.writeUInt32LE(pngs[i].length, base + 8);
    entradas.writeUInt32LE(offset, base + 12);
    offset += pngs[i].length;
  });

  return Buffer.concat([cabecalho, entradas, ...pngs]);
}

async function main() {
  for (const { de, para } of saidas) {
    if (!fs.existsSync(de)) {
      throw new Error(`Original não encontrado: ${de} — rode a partir da raiz do projeto.`);
    }
    fs.mkdirSync(path.dirname(para), { recursive: true });
  }

  for (const { de, para, descricao, transformar } of saidas) {
    const buffer = await transformar(sharp(de))
      .png({ compressionLevel: 9, palette: true })
      .toBuffer({ resolveWithObject: true });

    const antes = fs.existsSync(para) ? fs.statSync(para).size : 0;
    const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

    console.log(
      `${dryRun ? "[dry-run] " : ""}${para.padEnd(38)} ${String(buffer.info.width)}x${buffer.info.height}`.padEnd(60) +
        `${kb(buffer.data.length)}${antes ? ` (antes ${kb(antes)})` : ""}  — ${descricao}`,
    );

    if (!dryRun) fs.writeFileSync(para, buffer.data);
  }

  const ico = await montarIco(ORIGEM_SIMBOLO, [16, 32, 48]);
  const antesIco = fs.existsSync("src/app/favicon.ico")
    ? fs.statSync("src/app/favicon.ico").size
    : 0;
  console.log(
    `${dryRun ? "[dry-run] " : ""}${"src/app/favicon.ico".padEnd(38)} 16+32+48`.padEnd(60) +
      `${(ico.length / 1024).toFixed(0)}KB${antesIco ? ` (antes ${(antesIco / 1024).toFixed(0)}KB)` : ""}  — favicon legado (.ico tem precedência no navegador)`,
  );
  if (!dryRun) fs.writeFileSync("src/app/favicon.ico", ico);

  console.log(
    `\n${dryRun ? "Nada foi escrito." : "Pronto."} Os arquivos gerados são referenciados por src/components/brand/logo.tsx.`,
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
