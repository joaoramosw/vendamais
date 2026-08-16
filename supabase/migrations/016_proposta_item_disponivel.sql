-- =============================================================================
-- 016: Disponibilidade do item na proposta (Tem/Não tem)
--
-- Até aqui, um fornecedor sem o produto simplesmente deixava o preço em
-- R$ 0,00 e o item era descartado silenciosamente pelo formulário público
-- (nunca chegava a ser enviado) — não havia como distinguir "não tenho"
-- de "esqueci de preencher". Este campo permite ao fornecedor marcar
-- explicitamente que não tem o item; nesse caso preco_unitario é gravado
-- como 0 mas o item é enviado mesmo assim, pra o comprador saber que foi
-- perguntado e não foi ignorado. Default true (compatível com todas as
-- linhas já existentes, que representam itens efetivamente cotados).
-- =============================================================================

ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS disponivel boolean NOT NULL DEFAULT true;
