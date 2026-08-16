-- =============================================================================
-- 015: Nome da empresa do fornecedor
--
-- fornecedores_convidados não tem nenhum campo de identidade além de
-- email_contato/whatsapp — não há vínculo com users/profiles mesmo quando o
-- convite é feito escolhendo um usuário 'supplier' já cadastrado. Este campo
-- passa a ser preenchido em 3 pontos: cópia de users.organization_name ao
-- convidar um usuário existente, digitado pelo fornecedor no formulário
-- público de resposta (quando não tem conta), ou digitado pelo empresário ao
-- convidar por e-mail/WhatsApp avulso.
-- =============================================================================

ALTER TABLE fornecedores_convidados ADD COLUMN IF NOT EXISTS nome_empresa text;
