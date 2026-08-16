import assert from 'node:assert';
import test from 'node:test';
import {
  avaliarTendencia,
  calcularValorIdeal,
  DEFAULT_MARGEM_CONFIG,
  calcularPrecoVenda,
  diferencaPercentual,
  normalizarMargemConfig,
  roundHalfUp,
} from './margem';

test('Motor de Margem / valor ideal', async (t) => {
  await t.test('1. calcularValorIdeal — markup (método padrão)', () => {
    // Caso do enunciado: 100 / 1,285 = 77,8210... -> 77,82
    assert.strictEqual(calcularValorIdeal(100, 28.5), 77.82);
    // Método é markup por default (parâmetro omitido acima) e explícito aqui
    assert.strictEqual(calcularValorIdeal(100, 28.5, 'markup'), 77.82);
    // Margem zero: valor ideal é o próprio preço de loja
    assert.strictEqual(calcularValorIdeal(49.9, 0), 49.9);
    assert.strictEqual(calcularValorIdeal(10, 100), 5);
  });

  await t.test('2. calcularValorIdeal — desconto direto (alternativo)', () => {
    // 100 * (1 - 0,285) = 71,50
    assert.strictEqual(calcularValorIdeal(100, 28.5, 'desconto'), 71.5);
    // Margem >= 100% zeraria/negativaria o custo — não é calculável
    assert.strictEqual(calcularValorIdeal(100, 100, 'desconto'), null);
    assert.strictEqual(calcularValorIdeal(100, 120, 'desconto'), null);
  });

  await t.test('3. calcularValorIdeal — sem base de cálculo', () => {
    assert.strictEqual(calcularValorIdeal(null, 28.5), null);
    assert.strictEqual(calcularValorIdeal(undefined, 28.5), null);
    assert.strictEqual(calcularValorIdeal(0, 28.5), null);
    assert.strictEqual(calcularValorIdeal(-10, 28.5), null);
    assert.strictEqual(calcularValorIdeal(100, Number.NaN), null);
  });

  await t.test('4. roundHalfUp — metade sobe, apesar do ponto flutuante', () => {
    // 77.815 * 100 vale 7781.499999999999 em binário; half-up exige 77.82
    assert.strictEqual(roundHalfUp(77.815), 77.82);
    assert.strictEqual(roundHalfUp(1.005), 1.01);
    assert.strictEqual(roundHalfUp(2.675), 2.68);
    assert.strictEqual(roundHalfUp(-1.005), -1.01); // half-up "pra longe do zero"
    assert.strictEqual(roundHalfUp(10), 10);
  });

  await t.test('5. avaliarTendencia — três estados com tolerância', () => {
    const ideal = calcularValorIdeal(100, 28.5)!; // 77.82
    // Tolerância padrão de 0,5% -> folga de ~R$ 0,389
    assert.strictEqual(avaliarTendencia(80, ideal, 0.5), 'acima');
    assert.strictEqual(avaliarTendencia(77.82, ideal, 0.5), 'igual');
    assert.strictEqual(avaliarTendencia(77.9, ideal, 0.5), 'igual'); // dentro da folga
    assert.strictEqual(avaliarTendencia(78.2, ideal, 0.5), 'igual'); // borda de dentro (limite 78,209)
    assert.strictEqual(avaliarTendencia(78.3, ideal, 0.5), 'acima'); // primeiro passo fora da folga
    assert.strictEqual(avaliarTendencia(70, ideal, 0.5), 'abaixo');
  });

  await t.test('6. avaliarTendencia — tolerância zero volta a ser comparação exata', () => {
    assert.strictEqual(avaliarTendencia(77.82, 77.82, 0), 'igual');
    assert.strictEqual(avaliarTendencia(77.83, 77.82, 0), 'acima');
    assert.strictEqual(avaliarTendencia(77.81, 77.82, 0), 'abaixo');
  });

  await t.test('7. avaliarTendencia — sem ideal calculável', () => {
    assert.strictEqual(avaliarTendencia(50, null), null);
    assert.strictEqual(avaliarTendencia(null, 77.82), null);
    assert.strictEqual(avaliarTendencia(50, 0), null);
  });

  await t.test('8. diferencaPercentual', () => {
    assert.strictEqual(diferencaPercentual(100, 80), 25);
    assert.strictEqual(diferencaPercentual(80, 100), -20);
    assert.strictEqual(diferencaPercentual(80, 80), 0);
    assert.strictEqual(diferencaPercentual(80, null), null);
  });

  await t.test('9. normalizarMargemConfig — cai no padrão campo a campo', () => {
    assert.deepStrictEqual(normalizarMargemConfig(null), DEFAULT_MARGEM_CONFIG);
    assert.deepStrictEqual(normalizarMargemConfig({}), DEFAULT_MARGEM_CONFIG);
    assert.deepStrictEqual(normalizarMargemConfig({ margem_percent: 40 }), {
      ...DEFAULT_MARGEM_CONFIG,
      margem_percent: 40,
    });
    assert.deepStrictEqual(
      normalizarMargemConfig({ margem_percent: 'x', tolerancia_percent: 2, metodo: 'desconto' }),
      { margem_percent: DEFAULT_MARGEM_CONFIG.margem_percent, tolerancia_percent: 2, metodo: 'desconto' },
    );
    // método inválido não contamina o resto
    assert.strictEqual(normalizarMargemConfig({ metodo: 'inventado' }).metodo, 'markup');
  });

  await t.test('10. calcularPrecoVenda — inverso exato de calcularValorIdeal', () => {
    // Fecha o ciclo do exemplo canônico: 100 -> 77.82 -> 100
    assert.strictEqual(calcularValorIdeal(100, 28.5), 77.82);
    assert.strictEqual(calcularPrecoVenda(77.82, 28.5), 100);

    assert.strictEqual(calcularPrecoVenda(100, 0), 100);
    assert.strictEqual(calcularPrecoVenda(80, 25), 100);
    assert.strictEqual(calcularPrecoVenda(75, 100), 150);

    // desconto: ideal = preco * (1 - m)  =>  preco = custo / (1 - m)
    assert.strictEqual(calcularValorIdeal(100, 28.5, 'desconto'), 71.5);
    assert.strictEqual(calcularPrecoVenda(71.5, 28.5, 'desconto'), 100);
    assert.strictEqual(calcularPrecoVenda(50, 100, 'desconto'), null);

    // sem base de cálculo
    assert.strictEqual(calcularPrecoVenda(null, 28.5), null);
    assert.strictEqual(calcularPrecoVenda(0, 28.5), null);
    assert.strictEqual(calcularPrecoVenda(-5, 28.5), null);
    assert.strictEqual(calcularPrecoVenda(10, Number.NaN), null);
  });
});
