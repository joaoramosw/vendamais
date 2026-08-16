'use server'

import { SCORING_DEFAULT, SCORING_RULES } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export interface SupplierRankingEntry {
  fornecedorId: string
  nome: string
  empresa: string | null
  telefone: string | null
  totalScore: number
  avgPosition: number
  wins: number // 1st place count
  totalItems: number // items with valid price
  cotacoesParticipadas: number
  totalCotacoes: number
}

/**
 * Get aggregated supplier ranking across all quotations for this empresário.
 * @param dateFrom - optional ISO date string for filtering (e.g. last 30 days)
 */
export async function getRankingGeral(dateFrom?: string): Promise<SupplierRankingEntry[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all cotações for this empresário
  let query = supabase
    .from('cotacoes')
    .select(`
      id,
      cotacao_itens (id),
      propostas (
        id,
        fornecedor_id,
        profiles:fornecedor_id (nome, empresa, telefone),
        proposta_itens (
          cotacao_item_id,
          preco_unitario
        )
      )
    `)
    .eq('empresario_id', user.id)

  if (dateFrom) {
    query = query.gte('created_at', dateFrom)
  }

  const { data: cotacoes } = await query

  if (!cotacoes || cotacoes.length === 0) return []

  // Aggregate scores per supplier
  const supplierMap: Record<string, {
    nome: string
    empresa: string | null
    telefone: string | null
    totalScore: number
    positions: number[] // all positions for avg calculation
    wins: number
    totalItems: number
    cotacaoIds: Set<string>
  }> = {}

  const totalCotacoes = cotacoes.length

  for (const cotacao of cotacoes) {
    const items = cotacao.cotacao_itens || []

    // For each item, rank suppliers by price
    for (const item of items) {
      const prices: { fornecedorId: string; price: number; proposta: any }[] = []

      for (const p of (cotacao.propostas || [])) {
        const pi = (p.proposta_itens || []).find(
          (pi: any) => pi.cotacao_item_id === (item as any).id
        )
        if (pi && pi.preco_unitario > 0) {
          prices.push({
            fornecedorId: p.fornecedor_id,
            price: pi.preco_unitario,
            proposta: p,
          })
        }
      }

      // Sort by price ascending
      prices.sort((a, b) => a.price - b.price)

      // Award points
      prices.forEach((entry, idx) => {
        const rank = idx + 1
        const points = SCORING_RULES[rank] ?? SCORING_DEFAULT

        if (!supplierMap[entry.fornecedorId]) {
          const profile = entry.proposta.profiles as any
          supplierMap[entry.fornecedorId] = {
            nome: profile?.nome || 'Fornecedor',
            empresa: profile?.empresa || null,
            telefone: profile?.telefone || null,
            totalScore: 0,
            positions: [],
            wins: 0,
            totalItems: 0,
            cotacaoIds: new Set(),
          }
        }

        const supplier = supplierMap[entry.fornecedorId]
        supplier.totalScore += points
        supplier.positions.push(rank)
        supplier.totalItems += 1
        supplier.cotacaoIds.add(cotacao.id)
        if (rank === 1) supplier.wins += 1
      })
    }
  }

  // Convert to array and sort by score descending
  const result: SupplierRankingEntry[] = Object.entries(supplierMap)
    .map(([fornecedorId, data]) => ({
      fornecedorId,
      nome: data.nome,
      empresa: data.empresa,
      telefone: data.telefone,
      totalScore: data.totalScore,
      avgPosition: data.positions.length > 0
        ? Math.round((data.positions.reduce((a, b) => a + b, 0) / data.positions.length) * 10) / 10
        : 0,
      wins: data.wins,
      totalItems: data.totalItems,
      cotacoesParticipadas: data.cotacaoIds.size,
      totalCotacoes,
    }))
    .sort((a, b) => b.totalScore - a.totalScore)

  return result
}
