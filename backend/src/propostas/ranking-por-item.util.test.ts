import assert from 'node:assert';
import test from 'node:test';
import { CotacaoItemRow } from '../cotacoes/cotacoes.types';
import { PropostaItemRow } from './propostas.types';
import { calcularRankingPorItem, PropostaParaRanking } from './ranking-por-item.util';

function item(overrides: Partial<CotacaoItemRow> & { nome_produto: string }): CotacaoItemRow {
  return {
    id: `item-${overrides.nome_produto}`,
    cotacao_id: 'cotacao-1',
    unidade: 'un',
    quantidade: 10,
    observacao: null,
    codigo_barras: null,
    categoria: null,
    product_id: null,
    descricao: null,
    estoque_atual: null,
    quantidade_sugerida: null,
    tipo_unidade: 'UN',
    preco_unitario_manual: null,
    preco_manual: false,
    ...overrides,
  };
}

function propostaItem(
  overrides: Partial<PropostaItemRow> & { proposta_id: string; produto_nome: string },
): PropostaItemRow {
  return {
    id: `pi-${overrides.proposta_id}-${overrides.produto_nome}`,
    quantidade: 10,
    observacao: null,
    disponivel: true,
    created_at: '2026-01-01T00:00:00.000Z',
    preco_unitario: 0,
    ...overrides,
  };
}

function proposta(overrides: Partial<PropostaParaRanking> & { id: string }): PropostaParaRanking {
  return {
    fornecedor_convidado_id: `fornecedor-${overrides.id}`,
    nome_empresa: null,
    email_contato: null,
    whatsapp: null,
    prazo_entrega: null,
    created_at: '2026-01-01T00:00:00.000Z',
    itens: [],
    ...overrides,
  };
}

test('calcularRankingPorItem', async (t) => {
  await t.test('item sem nenhuma proposta aparece com ranking vazio', () => {
    const itens = [item({ nome_produto: 'Arroz' })];
    const resultado = calcularRankingPorItem(itens, []);

    assert.strictEqual(resultado.length, 1);
    assert.strictEqual(resultado[0].nome_produto, 'Arroz');
    assert.deepStrictEqual(resultado[0].ranking, []);
  });

  await t.test('item cotado por só 1 fornecedor tem ranking com 1 posição', () => {
    const itens = [item({ nome_produto: 'Feijão' })];
    const propostas = [
      proposta({
        id: 'p1',
        itens: [propostaItem({ proposta_id: 'p1', produto_nome: 'Feijão', preco_unitario: 5 })],
      }),
    ];

    const resultado = calcularRankingPorItem(itens, propostas);

    assert.strictEqual(resultado[0].ranking.length, 1);
    assert.strictEqual(resultado[0].ranking[0].proposta_id, 'p1');
  });

  await t.test('menor preço vence — proposta mais cara fica em 2º', () => {
    const itens = [item({ nome_produto: 'Açúcar' })];
    const propostas = [
      proposta({
        id: 'caro',
        itens: [propostaItem({ proposta_id: 'caro', produto_nome: 'Açúcar', preco_unitario: 8 })],
      }),
      proposta({
        id: 'barato',
        itens: [propostaItem({ proposta_id: 'barato', produto_nome: 'Açúcar', preco_unitario: 5 })],
      }),
    ];

    const resultado = calcularRankingPorItem(itens, propostas);

    assert.strictEqual(resultado[0].ranking[0].proposta_id, 'barato');
    assert.strictEqual(resultado[0].ranking[1].proposta_id, 'caro');
  });

  await t.test('empate de preço é desempatado por quem enviou primeiro', () => {
    const itens = [item({ nome_produto: 'Óleo' })];
    const propostas = [
      proposta({
        id: 'depois',
        created_at: '2026-01-02T00:00:00.000Z',
        itens: [
          propostaItem({
            proposta_id: 'depois',
            produto_nome: 'Óleo',
            preco_unitario: 7,
            created_at: '2026-01-02T00:00:00.000Z',
          }),
        ],
      }),
      proposta({
        id: 'antes',
        created_at: '2026-01-01T00:00:00.000Z',
        itens: [
          propostaItem({
            proposta_id: 'antes',
            produto_nome: 'Óleo',
            preco_unitario: 7,
            created_at: '2026-01-01T00:00:00.000Z',
          }),
        ],
      }),
    ];

    const resultado = calcularRankingPorItem(itens, propostas);

    assert.strictEqual(resultado[0].ranking[0].proposta_id, 'antes');
    assert.strictEqual(resultado[0].ranking[1].proposta_id, 'depois');
  });

  await t.test('propostas de itens diferentes não se misturam no casamento por nome_produto', () => {
    const itens = [item({ nome_produto: 'Arroz' }), item({ nome_produto: 'Feijão' })];
    const propostas = [
      proposta({
        id: 'p1',
        itens: [propostaItem({ proposta_id: 'p1', produto_nome: 'Arroz', preco_unitario: 4 })],
      }),
    ];

    const resultado = calcularRankingPorItem(itens, propostas);

    const arroz = resultado.find((r) => r.nome_produto === 'Arroz');
    const feijao = resultado.find((r) => r.nome_produto === 'Feijão');

    assert.strictEqual(arroz?.ranking.length, 1);
    assert.strictEqual(feijao?.ranking.length, 0);
  });

  await t.test('item marcado como "não tenho" (disponivel: false) não entra no ranking, mas aparece em indisponiveis', () => {
    const itens = [item({ nome_produto: 'Café' })];
    const propostas = [
      proposta({
        id: 'sem-produto',
        nome_empresa: 'Empório Não-Tem',
        itens: [
          propostaItem({
            proposta_id: 'sem-produto',
            produto_nome: 'Café',
            preco_unitario: 0,
            disponivel: false,
          }),
        ],
      }),
      proposta({
        id: 'com-produto',
        itens: [propostaItem({ proposta_id: 'com-produto', produto_nome: 'Café', preco_unitario: 9 })],
      }),
    ];

    const resultado = calcularRankingPorItem(itens, propostas);

    assert.strictEqual(resultado[0].ranking.length, 1);
    assert.strictEqual(resultado[0].ranking[0].proposta_id, 'com-produto');
    assert.strictEqual(resultado[0].indisponiveis.length, 1);
    assert.strictEqual(resultado[0].indisponiveis[0].fornecedor_convidado_id, 'fornecedor-sem-produto');
    assert.strictEqual(resultado[0].indisponiveis[0].nome_empresa, 'Empório Não-Tem');
  });

  await t.test('observação do item da proposta e prazo da proposta chegam na entrada do ranking', () => {
    const itens = [item({ nome_produto: 'Leite' })];
    const propostas = [
      proposta({
        id: 'p1',
        prazo_entrega: '3 dias úteis',
        itens: [
          propostaItem({
            proposta_id: 'p1',
            produto_nome: 'Leite',
            preco_unitario: 4,
            observacao: 'Só na caixa fechada com 12 unidades.',
          }),
        ],
      }),
    ];

    const resultado = calcularRankingPorItem(itens, propostas);

    assert.strictEqual(resultado[0].ranking[0].observacao, 'Só na caixa fechada com 12 unidades.');
    assert.strictEqual(resultado[0].ranking[0].prazo_entrega, '3 dias úteis');
  });

  await t.test('observações gerais da proposta acompanham cada entrada do ranking', () => {
    const itens = [item({ id: 'i1', nome_produto: 'Leite' }), item({ id: 'i2', nome_produto: 'Café' })];
    const propostas = [
      proposta({
        id: 'p1',
        observacao: 'Entrego só às terças, pedido mínimo de R$ 500.',
        itens: [
          propostaItem({ proposta_id: 'p1', produto_nome: 'Leite', preco_unitario: 4 }),
          propostaItem({ proposta_id: 'p1', produto_nome: 'Café', preco_unitario: 20 }),
        ],
      }),
    ];

    const resultado = calcularRankingPorItem(itens, propostas);

    // Vale pra proposta inteira, então repete em todo item que ela cotou.
    assert.strictEqual(
      resultado[0].ranking[0].observacao_proposta,
      'Entrego só às terças, pedido mínimo de R$ 500.',
    );
    assert.strictEqual(
      resultado[1].ranking[0].observacao_proposta,
      'Entrego só às terças, pedido mínimo de R$ 500.',
    );
  });

  await t.test('sem a migration 023 a observação geral vira null, sem quebrar o ranking', () => {
    const itens = [item({ nome_produto: 'Leite' })];
    // `observacao` ausente = coluna propostas.observacao ainda não existe.
    const propostas = [
      proposta({
        id: 'p1',
        itens: [propostaItem({ proposta_id: 'p1', produto_nome: 'Leite', preco_unitario: 4 })],
      }),
    ];

    const resultado = calcularRankingPorItem(itens, propostas);

    assert.strictEqual(resultado[0].ranking[0].observacao_proposta, null);
  });

  await t.test('justificativa do "não tenho" é preservada em indisponiveis', () => {
    const itens = [item({ nome_produto: 'Café' })];
    const propostas = [
      proposta({
        id: 'sem-produto',
        whatsapp: '5511999999999',
        itens: [
          propostaItem({
            proposta_id: 'sem-produto',
            produto_nome: 'Café',
            preco_unitario: 0,
            disponivel: false,
            observacao: 'Volta ao estoque dia 20.',
          }),
        ],
      }),
    ];

    const resultado = calcularRankingPorItem(itens, propostas);

    assert.strictEqual(resultado[0].indisponiveis[0].observacao, 'Volta ao estoque dia 20.');
    assert.strictEqual(resultado[0].indisponiveis[0].whatsapp, '5511999999999');
  });

  await t.test('preserva quantidade_sugerida e estoque_atual do item', () => {
    const itens = [item({ nome_produto: 'Arroz', quantidade_sugerida: 20, estoque_atual: 5 })];
    const resultado = calcularRankingPorItem(itens, []);

    assert.strictEqual(resultado[0].quantidade_sugerida, 20);
    assert.strictEqual(resultado[0].estoque_atual, 5);
  });

  await t.test('preserva preco_unitario_manual e preco_manual do item', () => {
    const itens = [
      item({ nome_produto: 'Feijão', preco_unitario_manual: 12.5, preco_manual: true }),
      item({ nome_produto: 'Arroz' }),
    ];
    const resultado = calcularRankingPorItem(itens, []);

    const feijao = resultado.find((r) => r.nome_produto === 'Feijão');
    const arroz = resultado.find((r) => r.nome_produto === 'Arroz');

    assert.strictEqual(feijao?.preco_unitario_manual, 12.5);
    assert.strictEqual(feijao?.preco_manual, true);
    assert.strictEqual(arroz?.preco_unitario_manual, null);
    assert.strictEqual(arroz?.preco_manual, false);
  });
});
