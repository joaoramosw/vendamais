-- =====================================================================
-- RPC: calcular_market_share_fornecedor
-- Supabase SQL — Visão de Desempenho do Fornecedor
--
-- COMO CRIAR: Cole isso no Supabase SQL Editor e Execute.
--
-- COMO CHAMAR (Client):
--   const { data } = await supabase.rpc('calcular_market_share_fornecedor', {
--     p_fornecedor_convidado_id: '...'
--   });
--
-- RETORNA: uma linha com métricas de desempenho do fornecedor.
-- =====================================================================

CREATE OR REPLACE FUNCTION calcular_market_share_fornecedor(
    p_fornecedor_convidado_id UUID
)
RETURNS TABLE (
    total_convites             BIGINT,
    total_propostas_enviadas   BIGINT,
    total_propostas_aceitas    BIGINT,
    total_melhor_preco         BIGINT,
    taxa_resposta_pct          NUMERIC,
    taxa_vitoria_pct           NUMERIC,
    volume_transacionado       NUMERIC,
    ticket_medio               NUMERIC
)
LANGUAGE sql
STABLE  -- Não modifica dados (safe para caching)
SECURITY DEFINER  -- Roda com privilégios do owner para cruzar dados
AS $$

WITH
-- ── Base: todos os convites deste fornecedor ──────────────────────────────────
convites_do_fornecedor AS (
    SELECT fc.id AS convite_id, fc.cotacao_id
    FROM fornecedores_convidados fc
    WHERE fc.id = p_fornecedor_convidado_id
),

-- ── Propostas que ele chegou a enviar (com itens) ─────────────────────────────
propostas_enviadas AS (
    SELECT p.id AS proposta_id, p.cotacao_id, p.valor_total, p.status
    FROM propostas p
    WHERE p.fornecedor_convidado_id = p_fornecedor_convidado_id
      AND p.status IN ('enviada', 'aceita')  -- Exclui rascunhos
      AND (p.valor_total IS NOT NULL AND p.valor_total > 0)
),

-- ── Propostas marcadas como aceitas pelo empresário ───────────────────────────
propostas_aceitas AS (
    SELECT proposta_id
    FROM propostas_enviadas
    WHERE status = 'aceita'
),

-- ── Vitórias por menor preço: foi o menor valor em cada cotação? ──────────────
-- Para cada cotação onde este fornecedor enviou proposta, verifica se o
-- valor_total dele é o mínimo comparado a todos os outros da mesma cotação.
vitorias_por_preco AS (
    SELECT pe.proposta_id
    FROM propostas_enviadas pe
    WHERE pe.valor_total = (
        -- Subquery: menor valor_total entre TODAS as propostas da mesma cotação
        SELECT MIN(p2.valor_total)
        FROM propostas p2
        WHERE p2.cotacao_id = pe.cotacao_id
          AND p2.status IN ('enviada', 'aceita')
          AND p2.valor_total > 0
    )
),

-- ── Volume financeiro: soma de todas as propostas enviadas ────────────────────
volume AS (
    SELECT
        COALESCE(SUM(valor_total), 0) AS total_volume,
        COALESCE(AVG(valor_total), 0) AS avg_ticket
    FROM propostas_enviadas
)

-- ── Resultado Final ────────────────────────────────────────────────────────────
SELECT
    -- Quantas vezes foi convidado
    (SELECT COUNT(*) FROM convites_do_fornecedor)::BIGINT                   AS total_convites,

    -- Quantas propostas ele realmente enviou
    (SELECT COUNT(*) FROM propostas_enviadas)::BIGINT                       AS total_propostas_enviadas,

    -- Quantas foram aceitas pelo empresário
    (SELECT COUNT(*) FROM propostas_aceitas)::BIGINT                        AS total_propostas_aceitas,

    -- Quantas vezes foi o de menor preço (ganhou racional de preço)
    (SELECT COUNT(*) FROM vitorias_por_preco)::BIGINT                       AS total_melhor_preco,

    -- Taxa de Resposta: propostas enviadas / convites recebidos (%)
    ROUND(
        CASE
            WHEN (SELECT COUNT(*) FROM convites_do_fornecedor) = 0 THEN 0
            ELSE (SELECT COUNT(*) FROM propostas_enviadas)::NUMERIC
                / (SELECT COUNT(*) FROM convites_do_fornecedor)::NUMERIC * 100
        END,
        1
    )                                                                        AS taxa_resposta_pct,

    -- Taxa de Vitória: vezes que ganhou (menor preço OU aceita) / propostas enviadas (%)
    ROUND(
        CASE
            WHEN (SELECT COUNT(*) FROM propostas_enviadas) = 0 THEN 0
            ELSE (
                -- Usa UNION para evitar double-count de propostas aceitas que tb são menor preço
                SELECT COUNT(*) FROM (
                    SELECT proposta_id FROM propostas_aceitas
                    UNION
                    SELECT proposta_id FROM vitorias_por_preco
                ) wins
            )::NUMERIC
            / (SELECT COUNT(*) FROM propostas_enviadas)::NUMERIC * 100
        END,
        1
    )                                                                        AS taxa_vitoria_pct,

    -- Volume Total Transacionado (soma das propostas enviadas)
    ROUND((SELECT total_volume FROM volume), 2)                             AS volume_transacionado,

    -- Ticket Médio por Proposta
    ROUND((SELECT avg_ticket FROM volume), 2)                               AS ticket_medio;

$$;


-- =====================================================================
-- GRANT DE ACESSO: Permite que usuários autenticados chamem a RPC.
-- O SECURITY DEFINER no corpo já cuida de buscar os dados com o owner.
-- =====================================================================
GRANT EXECUTE ON FUNCTION calcular_market_share_fornecedor(UUID) TO authenticated;


-- =====================================================================
-- EXEMPLO DE USO DIRETO NO SQL:
-- SELECT * FROM calcular_market_share_fornecedor('<uuid-do-fornecedor>');
-- =====================================================================
