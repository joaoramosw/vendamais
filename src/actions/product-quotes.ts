'use server'

import { getCurrentUserRole } from '@/lib/roles.server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addProductQuote(
  productId: string,
  companyName: string,
  price: number
) {
  const supabase = await createClient()
  const role = await getCurrentUserRole()

  if (role !== 'admin') {
    return { error: 'Sem permissao para adicionar cotacoes.' }
  }

  if (!companyName?.trim()) {
    return { error: 'Nome da empresa é obrigatório.' }
  }

  if (!price || price <= 0) {
    return { error: 'Preço inválido.' }
  }

  const { error } = await supabase.from('product_quotes').insert({
    product_id: productId,
    company_name: companyName.trim(),
    price,
  })

  if (error) return { error: error.message }

  revalidatePath('/empresario/produtos')
  revalidatePath(`/empresario/produtos/editar/${productId}`)
  return { success: true }
}

export async function getProductQuotes(productId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('product_quotes')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}
