-- =============================================================================
-- 013: WhatsApp do usuário
--
-- Adiciona telefone/WhatsApp ao usuário administrado (tabela users). Mesmo
-- nome de coluna usado em fornecedores_convidados (migration 011) por
-- consistência: whatsapp text. Só formatação/validação de número BR, sem
-- verificação real de WhatsApp (ver src/lib/whatsapp.ts).
-- =============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp text;
