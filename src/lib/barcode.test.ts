import assert from 'node:assert';
import test from 'node:test';
import { normalizeBarcode, looksLikeBarcode } from './barcode';

test('barcode', async (t) => {

  await t.test('normalizeBarcode', () => {
    assert.strictEqual(normalizeBarcode('7891234567895'), '7891234567895');
    assert.strictEqual(normalizeBarcode('  7891234567895  '), '7891234567895');
    assert.strictEqual(normalizeBarcode('789 123 456'), '789123456');
    assert.strictEqual(normalizeBarcode('789\t123\n456'), '789123456');
    assert.strictEqual(normalizeBarcode(''), '');
    // Zeros à esquerda precisam ser preservados (nunca vira número)
    assert.strictEqual(normalizeBarcode('0001234'), '0001234');
  });

  await t.test('looksLikeBarcode', () => {
    // Numérico, 6+ dígitos
    assert.strictEqual(looksLikeBarcode('7891234567895'), true);
    // Alfanumérico, 6+ caracteres (a heurística antiga só aceitava dígitos)
    assert.strictEqual(looksLikeBarcode('ABC123'), true);
    // Curto demais
    assert.strictEqual(looksLikeBarcode('12345'), false);
    // Vazio
    assert.strictEqual(looksLikeBarcode(''), false);
    // Nome de produto comum não deve ser confundido com barcode
    assert.strictEqual(looksLikeBarcode('Arroz branco'), false);
    // Espaços nas pontas não devem afetar a checagem de tamanho
    assert.strictEqual(looksLikeBarcode('  123456  '), true);
  });

});
