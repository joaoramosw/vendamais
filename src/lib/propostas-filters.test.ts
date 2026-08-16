import assert from 'node:assert';
import test from 'node:test';
import type { PropostaComItens, PropostaItemRow } from './api/propostas-api';
import { FILTRO_MELHOR_GERAL, calcularVitorias, filtroPorProduto, ordenarPropostas } from './propostas-filters';

function propostaItem(overrides: Partial<PropostaItemRow> & { produto_nome: string }): PropostaItemRow {
  return {
    id: `pi-${overrides.produto_nome}`,
    proposta_id: 'proposta',
    quantidade: 10,
    observacao: null,
    disponivel: true,
    created_at: '2026-01-01T00:00:00.000Z',
    preco_unitario: 0,
    ...overrides,
  };
}

function proposta(overrides: Partial<PropostaComItens> & { id: string }): PropostaComItens {
  return {
    cotacao_id: 'cotacao-1',
    fornecedor_convidado_id: `fornecedor-${overrides.id}`,
    status: 'enviada',
    valor_total: 0,
    prazo_entrega: null,
    created_at: '2026-01-01T00:00:00.000Z',
    itens: [],
    email_contato: null,
    whatsapp: null,
    nome_empresa: null,
    ...overrides,
  };
}

test('calcularVitorias', async (t) => {
  await t.test('fornecedor que marcou "Não tenho" não ganha vitória pelo item', () => {
    const propostas = [
      proposta({
        id: 'nao-tem',
        itens: [propostaItem({ produto_nome: 'Café', preco_unitario: 0, disponivel: false })],
      }),
      proposta({
        id: 'tem',
        itens: [propostaItem({ produto_nome: 'Café', preco_unitario: 9 })],
      }),
    ];

    const vitorias = calcularVitorias(propostas);

    assert.strictEqual(vitorias.get('nao-tem'), 0);
  });
});

test('ordenarPropostas', async (t) => {
  await t.test('filtro por produto: quem marcou "Não tenho" não fica em 1º lugar', () => {
    const propostas = [
      proposta({
        id: 'nao-tem',
        itens: [propostaItem({ produto_nome: 'Café', preco_unitario: 0, disponivel: false })],
      }),
      proposta({
        id: 'tem',
        itens: [propostaItem({ produto_nome: 'Café', preco_unitario: 9 })],
      }),
    ];

    const ordenado = ordenarPropostas(propostas, filtroPorProduto('Café'), new Map());

    assert.strictEqual(ordenado[0].id, 'tem');
    assert.strictEqual(ordenado[1].id, 'nao-tem');
  });

  await t.test('melhor geral: ordena por vitórias, ignorando indisponíveis', () => {
    const propostas = [
      proposta({
        id: 'nao-tem',
        itens: [propostaItem({ produto_nome: 'Café', preco_unitario: 0, disponivel: false })],
      }),
      proposta({
        id: 'tem',
        itens: [propostaItem({ produto_nome: 'Café', preco_unitario: 9 })],
      }),
    ];

    const vitorias = calcularVitorias(propostas);
    const ordenado = ordenarPropostas(propostas, FILTRO_MELHOR_GERAL, vitorias);

    assert.strictEqual((vitorias.get('tem') ?? 0) >= (vitorias.get('nao-tem') ?? 0), true);
    assert.strictEqual(ordenado[0].id === 'nao-tem' && (vitorias.get('nao-tem') ?? 0) > 0, false);
  });
});
