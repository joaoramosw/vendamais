/**
 * useQuotationPermissions.ts
 *
 * A pure React hook that derives cotação-related permissions from the
 * user's RoleKey and the cotação's current status.
 *
 * This hook contains ZERO async calls or side effects — all decisions are
 * synchronous derivations from the permission functions in `roles.ts`.
 */

import { useMemo } from 'react'
import type { RoleKey } from '@/lib/types/database'
import {
  canViewAllPropostas,
  canEditPropostaPrice,
  canFinalizarCotacao,
  isSupplierRestricted,
} from '@/lib/roles'

export interface QuotationPermissions {
  canViewAllPropostas: boolean
  canEditPrice: boolean
  canFinalize: boolean
  isSupplierView: boolean
}

export function useQuotationPermissions(
  role: RoleKey | null,
  cotacaoStatus: 'rascunho' | 'aberta' | 'em_andamento' | 'encerrada'
): QuotationPermissions {
  return useMemo(
    () => ({
      canViewAllPropostas: canViewAllPropostas(role),
      canEditPrice: canEditPropostaPrice(role, cotacaoStatus),
      canFinalize: canFinalizarCotacao(role),
      isSupplierView: isSupplierRestricted(role),
    }),
    [role, cotacaoStatus]
  )
}
