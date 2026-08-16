// src/hooks/useMarginEngine.ts
import { useState, useMemo } from 'react';

export interface MarginEngineResult {
    marginPercent: number;
    setMarginPercent: (m: number) => void;
    simulatedSaleTotal: number;
    calculateItemResalePrice: (costPrice: number) => number;
}

const DEFAULT_MARGIN_PERCENT = 30; // 30% default margin se não informado

/**
 * Motor de Margem (Simulator).
 * Permite que o empresário simule o preço de venda final baseado na melhor proposta,
 * recalculando tudo instantaneamente.
 */
export function useMarginEngine(
    cheapestTotalCost: number, 
    initialMargin = DEFAULT_MARGIN_PERCENT
): MarginEngineResult {
    
    // Margem definida em porcentagem (ex: 30 = 30%)
    const [marginPercent, setMarginPercent] = useState<number>(initialMargin);

    // Calcula o Total Projetado de Venda da Cotação Vencedora
    const simulatedSaleTotal = useMemo(() => {
        if (cheapestTotalCost <= 0) return 0;
        return cheapestTotalCost * (1 + marginPercent / 100);
    }, [cheapestTotalCost, marginPercent]);

    // Calcula o preço projetado de venda para um ÚNICO item
    const calculateItemResalePrice = (costPrice: number) => {
        if (!costPrice || costPrice <= 0) return 0;
        return costPrice * (1 + marginPercent / 100);
    };

    return {
        marginPercent,
        setMarginPercent,
        simulatedSaleTotal,
        calculateItemResalePrice
    };
}
