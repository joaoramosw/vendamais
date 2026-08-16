import assert from 'node:assert';
import test from 'node:test';
import { nomeAbaExcel } from './excel-sheet-name';

test('nomeAbaExcel', async (t) => {
  await t.test('título simples passa inteiro', () => {
    assert.strictEqual(nomeAbaExcel('Compra Mensal'), 'Compra Mensal');
  });

  await t.test('colchetes viram hífen — era o que derrubava a exportação com 500', () => {
    // O hífen que sobra encostado na borda é aparado (o Excel não proíbe,
    // mas "-TESTE- Cabelos" numa aba fica feio à toa).
    assert.strictEqual(nomeAbaExcel('[TESTE] Cabelos'), 'TESTE- Cabelos');
  });

  await t.test('barra de data no título não quebra mais', () => {
    assert.strictEqual(nomeAbaExcel('Compra 12/08 - Cabelos'), 'Compra 12-08 - Cabelos');
  });

  await t.test('todos os caracteres proibidos pelo Excel são trocados', () => {
    const saida = nomeAbaExcel('a*b?c:d\\e/f[g]h');
    assert.ok(!/[*?:\\/[\]]/.test(saida), `sobrou caractere proibido em "${saida}"`);
  });

  await t.test('respeita o limite de 31 caracteres do Excel', () => {
    const saida = nomeAbaExcel('x'.repeat(80));
    assert.strictEqual(saida.length, 31);
  });

  await t.test('não termina com separador solto depois do corte', () => {
    // 31º caractere cairia em cima do ':' — não pode sobrar na ponta.
    const saida = nomeAbaExcel(`${'a'.repeat(30)}: resto do título`);
    assert.ok(!/[-']$/.test(saida), `terminou com separador: "${saida}"`);
  });

  await t.test('não começa com apóstrofo (o Excel recusa)', () => {
    assert.ok(!nomeAbaExcel("'aspas na frente").startsWith("'"));
  });

  await t.test('título vazio ou só de caracteres proibidos cai no padrão', () => {
    assert.strictEqual(nomeAbaExcel(''), 'Cotação');
    assert.strictEqual(nomeAbaExcel('///'), 'Cotação');
    assert.strictEqual(nomeAbaExcel('   '), 'Cotação');
  });
});
