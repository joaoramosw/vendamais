import assert from 'node:assert';
import test from 'node:test';
import {
  contrastRatio,
  hexToRgb,
  meetsWcagAA,
  meetsWcagAAA,
  relativeLuminance,
} from './contrast';

test('Contraste WCAG', async (t) => {

  await t.test('1. contrastRatio — casos conhecidos', () => {
    // Preto sobre branco (ou vice-versa) é o contraste máximo possível: 21:1
    assert.strictEqual(contrastRatio('#000000', '#FFFFFF'), 21);
    assert.strictEqual(contrastRatio('#FFFFFF', '#000000'), 21);

    // Mesma cor consigo mesma é o mínimo possível: 1:1
    assert.strictEqual(contrastRatio('#6366F1', '#6366F1'), 1);
  });

  await t.test('2. meetsWcagAA — casos que devem passar/falhar', () => {
    // Preto sobre branco passa com folga
    assert.strictEqual(meetsWcagAA('#000000', '#FFFFFF'), true);

    // Cinza claro sobre branco é um par clássico que falha AA (texto normal)
    assert.strictEqual(meetsWcagAA('#CCCCCC', '#FFFFFF'), false);

    // O par falho pode passar se tratado como "texto grande" (limiar 3:1)
    assert.strictEqual(meetsWcagAA('#949494', '#FFFFFF'), false);
    assert.strictEqual(meetsWcagAA('#949494', '#FFFFFF', { largeText: true }), true);
  });

  await t.test('3. meetsWcagAAA é mais estrito que AA', () => {
    // Um par que passa AA (>=4.5, aqui ~5.74:1) mas não AAA (>=7)
    assert.strictEqual(meetsWcagAA('#666666', '#FFFFFF'), true);
    assert.strictEqual(meetsWcagAAA('#666666', '#FFFFFF'), false);
  });

  await t.test('4. hexToRgb — formato inválido lança erro claro', () => {
    assert.throws(() => hexToRgb('not-a-color'), /Cor hex inválida/);
    assert.throws(() => hexToRgb('#FFF'), /Cor hex inválida/);
  });

  await t.test('5. relativeLuminance — extremos', () => {
    assert.strictEqual(relativeLuminance({ r: 0, g: 0, b: 0 }), 0);
    assert.strictEqual(relativeLuminance({ r: 255, g: 255, b: 255 }), 1);
  });

});
