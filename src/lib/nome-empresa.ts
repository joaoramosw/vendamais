/**
 * nome-empresa.ts — abreviação de razão social (puro, sem I/O).
 *
 * A tabela de comparação mostra três colunas de fornecedor lado a lado; razão
 * social por extenso ("COMERCIAL DISTRIBUIDORA SÃO JOSÉ LTDA ME") estoura a
 * largura e empurra o valor e o indicador pra fora da célula. Aqui cortamos o
 * ruído estrutural (sufixo jurídico, prefixo genérico de ramo) — o nome
 * completo continua acessível no `title` de quem renderiza.
 */

/** Sufixos jurídicos: não distinguem uma empresa da outra numa lista. */
const SUFIXOS = [
  'ltda me',
  'ltda epp',
  'ltda',
  'me',
  'epp',
  'eireli',
  'mei',
  's a',
  's/a',
  'sa',
  'e cia',
  'cia',
];

/** Prefixos de ramo: quase toda linha da lista começa com um deles, então
 * eles ocupam a largura sem ajudar a diferenciar. */
const PREFIXOS = [
  'comercial',
  'comercio de',
  'comercio e',
  'comercio',
  'distribuidora de',
  'distribuidora',
  'industria e',
  'industria de',
  'industria',
  'atacado de',
  'atacado',
  'supermercado',
];

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Versão curta do nome da empresa, preservando o que identifica.
 *
 * Nunca devolve string vazia: se a limpeza comer o nome inteiro (ex.:
 * "Distribuidora LTDA"), o original volta — melhor um nome comprido do que
 * uma célula sem identificação.
 */
export function abreviarNomeEmpresa(nome: string, maxPalavras = 3): string {
  const original = nome.trim().replace(/\s+/g, ' ');
  if (!original) return '';

  let restante = original;

  // Sufixo jurídico: compara sem acento/pontuação, mas corta do texto original
  // (o corte é por comprimento, então o texto exibido mantém a grafia real).
  for (const sufixo of SUFIXOS) {
    const normalizado = semAcento(restante).toLowerCase().replace(/[.,/]/g, ' ').replace(/\s+/g, ' ');
    if (normalizado.endsWith(` ${sufixo}`)) {
      const corte = restante.length - sufixo.length;
      restante = restante.slice(0, corte).replace(/[\s.,/-]+$/, '');
      break;
    }
  }

  for (const prefixo of PREFIXOS) {
    const normalizado = semAcento(restante).toLowerCase();
    if (normalizado.startsWith(`${prefixo} `)) {
      restante = restante.slice(prefixo.length).trim();
      break;
    }
  }

  const palavras = restante.split(' ').filter(Boolean);
  if (palavras.length === 0) return original;

  return palavras.slice(0, maxPalavras).join(' ');
}
