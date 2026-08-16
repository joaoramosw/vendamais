import assert from 'node:assert';
import test from 'node:test';
import {
  calculatePriceWithMargin,
  calculateMarginFromPrices,
  calculateQuoteTotal,
  validateQuoteTotal
} from './pricing-engine';

test('Motor de Preços e Margens', async (t) => {
  
  await t.test('1. calculatePriceWithMargin', () => {
    // 30% sobre 10.50 -> 10.50 * 1.30 = 13.65
    assert.strictEqual(calculatePriceWithMargin(10.50, 30), 13.65);
    
    // -10% sobre 50.00 -> 50.00 * 0.90 = 45.00
    assert.strictEqual(calculatePriceWithMargin(50.00, -10), 45.00);

    // Arredondamento (ex: 10.00 * 1.333 -> 13.33)
    assert.strictEqual(calculatePriceWithMargin(10.00, 33.3), 13.33);

    // Proteção contra negativos exagerados
    assert.strictEqual(calculatePriceWithMargin(100, -150), 0);

    // Proteção contra base negativa
    assert.throws(() => calculatePriceWithMargin(-10, 20), /Motor de Preços/);
  });

  await t.test('2. calculateMarginFromPrices', () => {
    // Normal: de 10 para 15 é 50% de margem
    assert.strictEqual(calculateMarginFromPrices(10, 15), 50.00);

    // Dízimas: de 10 para 13.33 deve dar aproximadamente 33.3%
    assert.strictEqual(calculateMarginFromPrices(10, 13.33), 33.3);

    // Base zero (ganhado de graça) vendido por 10 -> Margem infinita
    assert.strictEqual(calculateMarginFromPrices(0, 10), Infinity);

    // Proteção contra valores negativos
    assert.throws(() => calculateMarginFromPrices(-10, 15), /Motor de Preços/);
  });

  await t.test('3. calculateQuoteTotal', () => {
    const items = [
      { quantity: 2, unitPrice: 10.50 },   // 21.00
      { quantity: 1.5, unitPrice: 3.33 }   // 4.995 -> arredonda para 5.00
    ];
    // 21.00 + 5.00 = 26.00
    assert.strictEqual(calculateQuoteTotal(items), 26.00);

    // Proteção contra quantidade ou preço negativo
    assert.throws(() => calculateQuoteTotal([{ quantity: -1, unitPrice: 10 }]), /Motor de Preços/);
  });

  await t.test('4. validateQuoteTotal', () => {
    const items = [
      { quantity: 2, unitPrice: 10.50 }, // 21.00
      { quantity: 1, unitPrice: 5.00 }   // 5.00
    ]; // Total real: 26.00

    // Válido
    assert.strictEqual(validateQuoteTotal(items, 26.00), true);

    // Inválido (discrepância de 1 centavo)
    assert.strictEqual(validateQuoteTotal(items, 26.01), false);
    
    // Inválido (discrepância maior)
    assert.strictEqual(validateQuoteTotal(items, 25.00), false);
  });

});
