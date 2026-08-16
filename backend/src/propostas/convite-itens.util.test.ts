import assert from 'node:assert';
import test from 'node:test';
import { montarItensConvite } from './convite-itens.util';

test('montarItensConvite', async (t) => {
  await t.test('nunca expõe campos internos do comprador ao fornecedor', () => {
    // Item "completo", como viria do banco (com campos internos que NUNCA
    // devem chegar ao fornecedor) — usa `as any` de propósito pra simular
    // um objeto mais largo do que o tipo declarado de entrada aceita,
    // garantindo que a projeção corta os campos extras mesmo que alguém
    // amplie o objeto passado no futuro.
    const itemCompleto = {
      id: 'item-1',
      nome_produto: 'Arroz',
      unidade: 'CX',
      observacao: 'sacos de 5kg',
      product_id: 'produto-1',
      estoque_atual: 42,
      quantidade_sugerida: 10,
      quantidade: 10,
      preco_unitario_manual: 7.5,
      preco_manual: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const imagemPorProductId = new Map([['produto-1', 'https://example.com/arroz.png']]);
    const resultado = montarItensConvite([itemCompleto], imagemPorProductId);

    assert.strictEqual(resultado.length, 1);
    assert.deepStrictEqual(
      Object.keys(resultado[0]).sort(),
      ['id', 'imagem_url', 'nome_produto', 'observacao', 'unidade'].sort(),
    );
    assert.strictEqual(resultado[0].imagem_url, 'https://example.com/arroz.png');
  });

  await t.test('ordena por nome_produto (A-Z, pt-BR)', () => {
    const itens = [
      { id: '1', nome_produto: 'Óleo', unidade: 'UN', observacao: null, product_id: null },
      { id: '2', nome_produto: 'Arroz', unidade: 'UN', observacao: null, product_id: null },
      { id: '3', nome_produto: 'Feijão', unidade: 'UN', observacao: null, product_id: null },
    ];

    const resultado = montarItensConvite(itens, new Map());

    assert.deepStrictEqual(
      resultado.map((i) => i.nome_produto),
      ['Arroz', 'Feijão', 'Óleo'],
    );
  });

  await t.test('imagem_url é null quando não há product_id ou não há imagem cadastrada', () => {
    const itens = [
      { id: '1', nome_produto: 'Sem produto vinculado', unidade: 'UN', observacao: null, product_id: null },
      { id: '2', nome_produto: 'Produto sem imagem', unidade: 'UN', observacao: null, product_id: 'produto-2' },
    ];

    const resultado = montarItensConvite(itens, new Map());

    assert.strictEqual(resultado[0].imagem_url, null);
    assert.strictEqual(resultado[1].imagem_url, null);
  });
});
