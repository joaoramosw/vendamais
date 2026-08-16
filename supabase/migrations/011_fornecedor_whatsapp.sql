-- =============================================================================
-- 011: WhatsApp do fornecedor
--
-- Captura o número de WhatsApp do fornecedor na hora que ele responde uma
-- proposta (não existe telefone em nenhum lugar do modelo novo — users e
-- fornecedores_convidados não tinham esse campo, ver plano desta sessão).
-- =============================================================================

ALTER TABLE fornecedores_convidados ADD COLUMN IF NOT EXISTS whatsapp text;
