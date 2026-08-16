'use server'

import { getCurrentUserRole } from '@/lib/roles.server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ensureUser } from '@/lib/supabase/ensure-user'
import type { ProductWithQuote } from '@/lib/types/database'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'

// ─── Storage helpers ──────────────────────────────────────────────────────────

/**
 * Extrai o path relativo dentro do bucket a partir de uma URL pública do Supabase.
 * Ex: "https://<proj>.supabase.co/storage/v1/object/public/products/products/product-123.webp"
 *   → "products/product-123.webp"
 * Retorna null se a URL não pertencer ao nosso bucket ou não for do Supabase.
 */
function extractStoragePath(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  try {
    const url = new URL(imageUrl)
    // Supabase Storage path format: /storage/v1/object/public/{bucket}/{path}
    const marker = '/storage/v1/object/public/products/'
    const idx = url.pathname.indexOf(marker)
    if (idx === -1) return null
    const relativePath = url.pathname.slice(idx + marker.length)
    return relativePath || null
  } catch {
    return null
  }
}

/**
 * Remove imagem anterior do Supabase Storage se ela pertencer ao nosso bucket.
 * Fire-and-forget: não bloqueia o upload novo em caso de falha.
 */
async function removeOldProductImage(
  oldImageUrl: string | null | undefined,
): Promise<void> {
  const path = extractStoragePath(oldImageUrl)
  if (!path) return
  try {
    // Storage do bucket 'products' usa policies que checam a tabela `profiles`
    // legada (ver supabase/migrations/002_products_module.sql) — quase vazia
    // hoje (o modelo atual é `users`+`roles`). Client admin bypassa RLS aqui;
    // a autorização real já foi checada por quem chama esta função.
    const adminClient = createAdminClient()
    await adminClient.storage.from('products').remove([path])
  } catch {
    // Falha silenciosa — não impede novo upload
  }
}


/**
 * Registra um ponto na série histórica do preço de loja.
 *
 * Só grava quando o preço realmente mudou — salvar o produto mexendo só no
 * nome não deve gerar ponto no gráfico. Falha silenciosa de propósito: se a
 * migration 019 ainda não rodou no banco (padrão de divergência já conhecido,
 * ver CLAUDE.md), a edição do produto não pode quebrar por causa do histórico.
 */
async function registrarPrecoHistorico(
  adminClient: ReturnType<typeof createAdminClient>,
  productId: string,
  precoAnterior: number | null | undefined,
  precoNovo: number | null | undefined,
  userId: string | null,
): Promise<void> {
  if (precoNovo == null || !Number.isFinite(precoNovo) || precoNovo <= 0) return
  if (precoAnterior != null && Math.abs(precoAnterior - precoNovo) < 0.005) return

  const { error } = await adminClient.from('product_price_history').insert({
    product_id: productId,
    price_unit_store: precoNovo,
    changed_by: userId,
  })

  if (error) {
    console.error('[product_price_history] não foi possível registrar o preço:', error.message)
  }
}

interface GetProductsParams {
  search?: string
  category?: string
  barcode?: string
  dateFrom?: string
  dateTo?: string
  priceMin?: string
  priceMax?: string
  page?: number
  perPage?: number
}

interface GetProductsResult {
  products: ProductWithQuote[]
  total: number
  categories: { id: string; name: string; slug: string; color: string }[]
}

type ProductAccessContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  adminClient: ReturnType<typeof createAdminClient>
  userId: string
  activeOrganizationId: string | null
}

async function requireProductAccessContext(): Promise<ProductAccessContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const userRow = await ensureUser(supabase, user)

  if (userRow?.role !== 'admin') {
    redirect('/fornecedor/dashboard')
  }

  return {
    supabase,
    adminClient: createAdminClient(),
    userId: user.id,
    activeOrganizationId: userRow?.activeOrganizationId ?? null,
  }
}

function applyOrganizationScope<TQuery extends { or: (filters: string) => TQuery; is: (column: string, value: null) => TQuery }>(
  query: TQuery,
  organizationId: string | null
): TQuery {
  if (organizationId) {
    return query.or(`organization_id.eq.${organizationId},organization_id.is.null`)
  }

  return query.is('organization_id', null)
}

/**
 * Busca exata por barcode (diferente do filtro de getProducts, que usa
 * ilike/parcial) — usada pra abrir direto o produto ao invés de listar.
 */
export async function getProductIdByBarcode(barcode: string): Promise<{ productId: string | null }> {
  const { adminClient } = await requireProductAccessContext()
  const trimmed = barcode.trim()
  if (!trimmed) return { productId: null }

  const { data } = await adminClient
    .from('products')
    .select('id')
    .eq('barcode', trimmed)
    .is('deleted_at', null)
    .maybeSingle()

  return { productId: data?.id ?? null }
}

export async function getProducts(params: GetProductsParams = {}): Promise<GetProductsResult> {
  const { adminClient, activeOrganizationId } = await requireProductAccessContext()
  const { search, category, barcode, dateFrom, dateTo, page = 1, perPage = 20 } = params

  // Base query
  let query = applyOrganizationScope(
    adminClient
    .from('products')
    .select('*', { count: 'exact' })
    .is('deleted_at', null),
    activeOrganizationId
  )

  // Filters
  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
  }
  if (category) {
    query = query.eq('category', category)
  }
  if (barcode) {
    query = query.ilike('barcode', `%${barcode}%`)
  }
  if (dateFrom) {
    query = query.gte('created_at', dateFrom)
  }
  if (dateTo) {
    query = query.lte('created_at', dateTo)
  }

  // Pagination
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  query = query.order('created_at', { ascending: false }).range(from, to)

  const { data: products, error, count } = await query

  if (error) throw new Error(error.message)

  const productIds = (products ?? []).map((p) => p.id)

  // Fetch latest quote, categories, and product→category associations in parallel
  const [quotesResult, catResult, pcResult] = await Promise.all([
    productIds.length > 0
      ? adminClient
          .from('product_quotes')
          .select('id, product_id, company_name, price, created_at')
          .in('product_id', productIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: null }),
    applyOrganizationScope(
      adminClient
        .from('categories')
        .select('id, name, slug, color, organization_id')
        .is('deleted_at', null)
        .order('name', { ascending: true }),
      activeOrganizationId
    ),
    productIds.length > 0
      ? adminClient
          .from('product_categories')
          .select('product_id, category_id')
          .in('product_id', productIds)
      : Promise.resolve({ data: null }),
  ])

  const allQuotes = quotesResult.data
  const catData = catResult.data
  const pcData = pcResult.data

  let quotesMap: Record<string, { company_name: string; price: number; created_at: string; id: string; product_id: string }> = {}
  if (allQuotes) {
    for (const quote of allQuotes) {
      if (!quotesMap[quote.product_id]) {
        quotesMap[quote.product_id] = quote
      }
    }
  }

  const categories = (catData ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug, color: c.color ?? '#6366f1' }))

  let productCategoriesMap: Record<string, { id: string; name: string; slug: string; color: string; description: string | null; organization_id: string | null; created_at: string }[]> = {}
  if (pcData && catData) {
    const catMap = Object.fromEntries((catData ?? []).map((c) => [c.id, c]))
    for (const row of pcData) {
      const cat = catMap[row.category_id]
      if (cat) {
        if (!productCategoriesMap[row.product_id]) productCategoriesMap[row.product_id] = []
        productCategoriesMap[row.product_id].push({ ...cat, color: cat.color ?? '#6366f1', description: null, organization_id: null, created_at: '' })
      }
    }
  }

  // Filter by price range if specified (via latest quote)
  let enrichedProducts: ProductWithQuote[] = (products ?? []).map((p) => ({
    ...p,
    latest_quote: quotesMap[p.id] ?? null,
    categories: productCategoriesMap[p.id] ?? [],
  }))

  if (params.priceMin || params.priceMax) {
    const min = params.priceMin ? parseFloat(params.priceMin) : 0
    const max = params.priceMax ? parseFloat(params.priceMax) : Infinity
    enrichedProducts = enrichedProducts.filter((p) => {
      if (!p.latest_quote) return false
      return p.latest_quote.price >= min && p.latest_quote.price <= max
    })
  }

  return {
    products: enrichedProducts,
    total: count ?? 0,
    categories,
  }
}

export interface CategoryProductSummary {
  id: string
  name: string
  image_url: string | null
  barcode: string | null
  price_unit_store: number
}

/**
 * Resumo dos produtos de uma categoria — usado pelo modal que abre ao clicar
 * no contador da tela de Categorias.
 *
 * Lê pelo client admin como todo o resto deste arquivo (a RLS de `products`
 * depende da tabela `profiles` legada — ver CLAUDE.md, gotcha #21); a
 * autorização real é `requireProductAccessContext` + escopo de organização.
 */
export async function getProductsByCategory(
  categoryId: string,
  limit = 60,
): Promise<{ products: CategoryProductSummary[]; total: number; error?: string }> {
  const { adminClient, activeOrganizationId } = await requireProductAccessContext()

  const { data: vinculos, error: vinculosError } = await adminClient
    .from('product_categories')
    .select('product_id')
    .eq('category_id', categoryId)

  if (vinculosError) return { products: [], total: 0, error: vinculosError.message }

  const ids = [...new Set((vinculos ?? []).map((v) => v.product_id))]
  if (ids.length === 0) return { products: [], total: 0 }

  // `total` sai da consulta de produtos, não da contagem de vínculos: produto
  // excluído (soft delete) ou de outra organização continua com o vínculo,
  // mas não deve aparecer nem ser contado aqui.
  const { data, count, error } = await applyOrganizationScope(
    adminClient
      .from('products')
      .select('id, name, image_url, barcode, price_unit_store', { count: 'exact' })
      .in('id', ids)
      .is('deleted_at', null),
    activeOrganizationId,
  )
    .order('name', { ascending: true })
    .limit(limit)

  if (error) return { products: [], total: 0, error: error.message }

  return { products: (data ?? []) as CategoryProductSummary[], total: count ?? 0 }
}

export interface ProductSummary extends CategoryProductSummary {
  description: string | null
  category: string | null
}

/**
 * Resumo de um produto do catálogo — usado pelo acesso rápido e pelo detalhe
 * de um item da cotação, que precisam da imagem/preço mas não das cotações de
 * referência que `getProduct` carrega junto.
 *
 * Devolve `null` em vez de lançar (diferente de `getProduct`): o item da
 * cotação guarda `product_id` mesmo depois do produto ser excluído, e uma tela
 * de comparação não deve quebrar por causa disso. Lê pelo client admin pelo
 * mesmo motivo do resto do arquivo (RLS legada de `products`, gotcha #21).
 */
export async function getProductSummary(id: string): Promise<ProductSummary | null> {
  const { adminClient, activeOrganizationId } = await requireProductAccessContext()

  const { data, error } = await applyOrganizationScope(
    adminClient
      .from('products')
      .select('id, name, image_url, barcode, price_unit_store, description, category')
      .eq('id', id)
      .is('deleted_at', null),
    activeOrganizationId,
  ).maybeSingle()

  if (error || !data) return null
  return data as ProductSummary
}

export async function getProduct(id: string) {
  const { adminClient, activeOrganizationId } = await requireProductAccessContext()

  const { data: product, error } = await applyOrganizationScope(
    adminClient
      .from('products')
      .select('*')
      .eq('id', id),
    activeOrganizationId
  ).single()

  if (error) throw new Error(error.message)

  // Get all quotes for this product
  const { data: quotes } = await adminClient
    .from('product_quotes')
    .select('*')
    .eq('product_id', id)
    .order('created_at', { ascending: false })

  return { ...product, quotes: quotes ?? [] }
}

export async function createProduct(formData: FormData) {
  const { adminClient, userId, activeOrganizationId } = await requireProductAccessContext()
  const role = await getCurrentUserRole()

  if (role !== 'admin') {
    return { error: 'Sem permissao para criar produtos.' }
  }

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const barcode = formData.get('barcode') as string
  const category = formData.get('category') as string
  const imageUrl = formData.get('image_url') as string
  const priceUnitStore = formData.get('price_unit_store') as string

  if (!name?.trim()) {
    return { error: 'Nome do produto é obrigatório.' }
  }

  const { data: product, error } = await adminClient
    .from('products')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      barcode: barcode?.trim() || null,
      image_url: imageUrl?.trim() || null,
      category: category?.trim() || null,
      price_unit_store: priceUnitStore ? parseFloat(priceUnitStore) : 0,
      created_by: userId,
      organization_id: activeOrganizationId,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505' && error.message.includes('barcode')) {
      return { error: 'Já existe um produto com este código de barras.' }
    }
    return { error: error.message }
  }

  await registrarPrecoHistorico(
    adminClient,
    product.id,
    null,
    priceUnitStore ? parseFloat(priceUnitStore) : null,
    userId,
  )

  revalidatePath('/empresario/produtos')
  revalidatePath('/empresario/dashboard')
  return { success: true, productId: product.id }
}

export async function updateProduct(id: string, formData: FormData) {
  // Mesmo motivo do deleteProduct abaixo: a RLS de `products` (migration 002)
  // exige uma linha em `profiles` com role admin/moderador, e `profiles` está
  // praticamente vazia hoje (o modelo real é users+roles). O UPDATE pelo client
  // logado casava 0 linhas e voltava sem erro — o "salvar" respondia sucesso e
  // nada era gravado. Autorização real: requireProductAccessContext (role=admin)
  // + escopo de organização; a escrita usa o client admin (bypassa RLS).
  const { adminClient, activeOrganizationId, userId } = await requireProductAccessContext()
  const role = await getCurrentUserRole()

  if (role !== 'admin') {
    return { error: 'Sem permissao para editar produtos.' }
  }

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const barcode = formData.get('barcode') as string
  const category = formData.get('category') as string
  const imageUrl = formData.get('image_url') as string
  const priceUnitStore = formData.get('price_unit_store') as string

  if (!name?.trim()) {
    return { error: 'Nome do produto é obrigatório.' }
  }

  const { data: existing } = await applyOrganizationScope(
    adminClient
      .from('products')
      .select('id, price_unit_store')
      .eq('id', id)
      .is('deleted_at', null),
    activeOrganizationId
  ).maybeSingle()

  if (!existing) {
    return { error: 'Produto não encontrado ou fora da sua organização.' }
  }

  const updateData: Record<string, unknown> = {
    name: name.trim(),
    description: description?.trim() || null,
    barcode: barcode?.trim() || null,
    image_url: imageUrl?.trim() || null,
    category: category?.trim() || null,
  }
  if (priceUnitStore !== null && priceUnitStore !== undefined && priceUnitStore !== '') {
    updateData.price_unit_store = parseFloat(priceUnitStore)
  }

  // `.select()` é o que impede o modo de falha antigo de voltar: sem ele um
  // update que não casa nenhuma linha volta com error === null.
  const { data: updated, error } = await adminClient
    .from('products')
    .update(updateData)
    .eq('id', id)
    .select('id')

  if (error) {
    if (error.code === '23505' && error.message.includes('barcode')) {
      return { error: 'Já existe um produto com este código de barras.' }
    }
    return { error: error.message }
  }

  if (!updated || updated.length === 0) {
    return { error: 'Nenhuma alteração foi gravada. Recarregue a página e tente novamente.' }
  }

  // Ponto na série histórica — depois do update, e sem poder derrubá-lo.
  if (updateData.price_unit_store !== undefined) {
    await registrarPrecoHistorico(
      adminClient,
      id,
      existing.price_unit_store,
      updateData.price_unit_store as number,
      userId,
    )
  }

  revalidatePath('/empresario/produtos')
  revalidatePath(`/empresario/produtos/editar/${id}`)
  revalidatePath('/empresario/dashboard')
  return { success: true }
}

export async function deleteProduct(id: string) {
  // RLS da tabela products (migration 002) depende da tabela `profiles`
  // legada — praticamente vazia hoje (o modelo real é users+roles). Por isso
  // UPDATE via client logado é bloqueado silenciosamente e o soft delete nunca
  // acontecia. Mesmo padrão do createProduct/updateProduct: autorização real é
  // feita por requireProductAccessContext (role=admin) + escopo de organização
  // e a escrita usa o client admin (bypassa RLS).
  const { adminClient, activeOrganizationId } = await requireProductAccessContext()

  const { data: product } = await applyOrganizationScope(
    adminClient.from('products').select('id').eq('id', id),
    activeOrganizationId
  ).maybeSingle()

  if (!product) {
    return { error: 'Produto não encontrado ou fora da sua organização.' }
  }

  const { error } = await adminClient
    .from('products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/empresario/produtos')
  revalidatePath('/empresario/dashboard')
  return { success: true }
}

export async function deleteProductsBatch(ids: string[]) {
  // Mesmo motivo do deleteProduct acima: RLS de products depende de `profiles`
  // legada → escrita via client admin + escopo de organização (vejo `profiles`
  // comments em 002_products_module.sql). A UI só expõe exclusão a admins.
  const { adminClient, activeOrganizationId } = await requireProductAccessContext()

  const { data: products } = await applyOrganizationScope(
    adminClient.from('products').select('id').in('id', ids),
    activeOrganizationId
  )

  if (!products || products.length !== ids.length) {
    return { error: 'Um ou mais produtos não pertencem à sua organização ou já foram excluídos.' }
  }

  // Soft delete — não remove as imagens do storage, o registro é recuperável.
  const { error } = await adminClient
    .from('products')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: error.message }

  revalidatePath('/empresario/produtos')
  revalidatePath('/empresario/dashboard')
  return { success: true }
}

export async function batchUpdateProducts(
  productIds: string[],
  field: 'category',
  value: string
) {
  // Client admin + escopo explícito pelo mesmo motivo do updateProduct: a RLS
  // de `products` depende de `profiles` legada e bloqueia UPDATE em silêncio.
  const { adminClient, activeOrganizationId } = await requireProductAccessContext()
  const role = await getCurrentUserRole()

  if (role !== 'admin') {
    return { error: 'Sem permissao para edicao em lote.' }
  }

  if (productIds.length === 0) {
    return { error: 'Nenhum produto selecionado.' }
  }

  const { data: escopados } = await applyOrganizationScope(
    adminClient.from('products').select('id').in('id', productIds).is('deleted_at', null),
    activeOrganizationId
  )

  if (!escopados || escopados.length !== productIds.length) {
    return { error: 'Um ou mais produtos não pertencem à sua organização.' }
  }

  const { data: updated, error } = await adminClient
    .from('products')
    .update({ [field]: value.trim() || null })
    .in('id', productIds)
    .select('id')

  if (error) return { error: error.message }

  revalidatePath('/empresario/produtos')
  return { success: true, count: updated?.length ?? 0 }
}

export async function batchAddQuote(
  productIds: string[],
  companyName: string,
  price: number
) {
  const { adminClient } = await requireProductAccessContext()
  const role = await getCurrentUserRole()

  if (role !== 'admin') {
    return { error: 'Sem permissao para adicionar cotacoes.' }
  }

  if (productIds.length === 0) {
    return { error: 'Nenhum produto selecionado.' }
  }

  const inserts = productIds.map((pid) => ({
    product_id: pid,
    company_name: companyName.trim(),
    price,
  }))

  // product_quotes tem a mesma RLS baseada em `profiles` que products — insert
  // pelo client logado é descartado em silêncio. Ver updateProduct.
  const { error } = await adminClient.from('product_quotes').insert(inserts)

  if (error) return { error: error.message }

  revalidatePath('/empresario/produtos')
  return { success: true, count: productIds.length }
}

export async function duplicateProduct(id: string) {
  const { adminClient, userId, activeOrganizationId } = await requireProductAccessContext()
  const role = await getCurrentUserRole()

  if (role !== 'admin') {
    return { error: 'Sem permissao para duplicar produtos.' }
  }

  // Fetch original product
  const { data: original, error: fetchError } = await applyOrganizationScope(
    adminClient
      .from('products')
      .select('*')
      .eq('id', id),
    activeOrganizationId
  ).single()

  if (fetchError || !original) {
    return { error: 'Produto original não encontrado.' }
  }

  // Clone without barcode (unique constraint), preserving image and price
  const { data: newProduct, error: insertError } = await adminClient
    .from('products')
    .insert({
      name: `${original.name} (cópia)`,
      description: original.description,
      barcode: null,
      image_url: original.image_url,
      category: original.category,
      price_unit_store: original.price_unit_store ?? 0,
      created_by: userId,
      organization_id: original.organization_id ?? activeOrganizationId,
    })
    .select('id')
    .single()

  if (insertError) {
    return { error: insertError.message }
  }

  // Copia o arquivo de imagem no Storage para um path próprio do produto duplicado.
  // Não basta reaproveitar a mesma image_url: uploadProductImage apaga a imagem
  // anterior ao trocar a de qualquer um dos dois produtos (path é 1:1 com o id),
  // então compartilhar o mesmo arquivo quebraria a imagem do outro produto na
  // próxima edição. Roda depois da resposta (via `after`) para não atrasar o
  // redirect da UI — a imagem do duplicado só troca de URL alguns instantes
  // depois, o que é imperceptível pois até lá ela já mostra a imagem original.
  const oldPath = extractStoragePath(original.image_url)
  if (oldPath) {
    const ext = oldPath.split('.').pop() ?? 'webp'
    const newPath = `products/product-${newProduct.id}.${ext}`

    after(async () => {
      const { error: copyError } = await adminClient.storage
        .from('products')
        .copy(oldPath, newPath)

      if (!copyError) {
        const { data: publicUrl } = adminClient.storage
          .from('products')
          .getPublicUrl(newPath)

        await adminClient
          .from('products')
          .update({ image_url: publicUrl.publicUrl })
          .eq('id', newProduct.id)
      }
    })
  }

  revalidatePath('/empresario/produtos')
  return { success: true, productId: newProduct.id }
}

export async function uploadProductImage(formData: FormData): Promise<{ url?: string; error?: string }> {
  // Leitura e escrita em `products` via client admin — a RLS legada (baseada em
  // `profiles`) devolveria vazio aqui e a imagem antiga nunca seria apagada.
  const adminClient = createAdminClient()
  const role = await getCurrentUserRole()

  if (role !== 'admin') {
    return { error: 'Sem permissao para upload de imagens.' }
  }

  const file = formData.get('file') as File
  const productId = formData.get('productId') as string | null

  if (!file) return { error: 'Nenhum arquivo selecionado.' }

  // Guard de tamanho
  const MAX_BYTES = 5 * 1024 * 1024
  if (file.size > MAX_BYTES) {
    return { error: 'Imagem muito grande após compressão. Máximo: 5 MB.' }
  }

  const allowedTypes = [
    'image/webp', 'image/avif', 'image/jpeg', 'image/jpg',
    'image/png', 'image/gif', 'image/bmp', 'image/tiff',
  ]
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return { error: `Formato inválido (${file.type}). Aceitos: JPG, PNG, WebP, AVIF.` }
  }

  // ── SUBSTITUIÇÃO SEGURA: remove imagem anterior do Storage ──────────────────
  if (productId) {
    const { data: existing } = await adminClient
      .from('products')
      .select('image_url')
      .eq('id', productId)
      .single()
    await removeOldProductImage(existing?.image_url)
  }

  let ext = 'webp'
  if (file.type === 'image/avif') ext = 'avif'
  else if (file.type === 'image/jpeg' || file.type === 'image/jpg') ext = 'jpg'
  else if (file.type === 'image/png') ext = 'png'

  const fileName = productId
    ? `product-${productId}.${ext}`
    : `product-${Date.now()}.${ext}`
  const storagePath = `products/${fileName}`

  // Storage do bucket 'products' usa policies que checam a tabela `profiles`
  // legada (ver supabase/migrations/002_products_module.sql), praticamente
  // vazia hoje — client admin bypassa RLS; a checagem de role acima já usa
  // o modelo atual (users/roles).
  const { error: uploadError } = await adminClient.storage
    .from('products')
    .upload(storagePath, file, {
      contentType: file.type,
      cacheControl: `${60 * 60 * 24 * 30}`,
      upsert: true,
    })

  if (uploadError) return { error: uploadError.message }

  const { data: publicUrl } = adminClient.storage
    .from('products')
    .getPublicUrl(storagePath)

  // Produto já existe (edição): persiste o novo image_url na hora, em vez de
  // depender do usuário clicar "Salvar" no formulário depois — mesmo padrão
  // já usado por removeProductImage (remove e já limpa o banco imediatamente).
  if (productId) {
    await adminClient
      .from('products')
      .update({ image_url: publicUrl.publicUrl })
      .eq('id', productId)
  }

  return { url: publicUrl.publicUrl }
}

/**
 * Faz download de uma imagem via URL externa, verifica se é uma imagem válida,
 * e armazena no Supabase Storage (não salva apenas o link externo).
 * A compressão WebP já deve ter sido feita client-side antes de chamar esta action.
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  productId?: string | null,
): Promise<{ url?: string; error?: string }> {
  // Ver nota em uploadProductImage: `products` só é legível/gravável aqui pelo
  // client admin, por causa da RLS legada baseada em `profiles`.
  const adminClient = createAdminClient()
  const role = await getCurrentUserRole()

  if (role !== 'admin') {
    return { error: 'Sem permissao para upload de imagens.' }
  }

  // Valida formato da URL
  let parsedUrl: URL
  try {
    parsedUrl = new URL(imageUrl.trim())
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return { error: 'URL deve usar https ou http.' }
    }
  } catch {
    return { error: 'URL inválida.' }
  }

  // Faz download da imagem no servidor
  let imageBuffer: ArrayBuffer
  let contentType: string
  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: { 'User-Agent': 'VendaMais-Bot/1.0' },
      signal: AbortSignal.timeout(15_000), // timeout 15s
    })

    if (!response.ok) {
      return { error: `Não foi possível baixar a imagem (HTTP ${response.status}).` }
    }

    contentType = response.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) {
      return { error: 'A URL não aponta para uma imagem válida.' }
    }

    // Limita download a 15 MB
    const MAX_DOWNLOAD = 15 * 1024 * 1024
    const contentLength = Number(response.headers.get('content-length') ?? 0)
    if (contentLength > MAX_DOWNLOAD) {
      return { error: 'Imagem muito grande. Máximo: 15 MB para download.' }
    }

    imageBuffer = await response.arrayBuffer()

    if (imageBuffer.byteLength > MAX_DOWNLOAD) {
      return { error: 'Imagem baixada excede 15 MB.' }
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { error: 'Timeout ao baixar imagem. Tente outra URL.' }
    }
    return { error: 'Erro ao baixar imagem da URL fornecida.' }
  }

  // Detecta extensão pelo content-type
  let ext = 'webp'
  if (contentType.includes('png')) ext = 'png'
  else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg'
  else if (contentType.includes('avif')) ext = 'avif'
  else if (contentType.includes('gif')) ext = 'gif'

  // ── SUBSTITUIÇÃO SEGURA: remove imagem anterior do Storage ──────────────────
  if (productId) {
    const { data: existing } = await adminClient
      .from('products')
      .select('image_url')
      .eq('id', productId)
      .single()
    await removeOldProductImage(existing?.image_url)
  }

  const fileName = productId
    ? `product-${productId}.${ext}`
    : `product-url-${Date.now()}.${ext}`

  const storagePath = `products/${fileName}`

  // Storage do bucket 'products' usa policies que checam a tabela `profiles`
  // legada (ver supabase/migrations/002_products_module.sql), praticamente
  // vazia hoje — client admin bypassa RLS; a checagem de role acima já usa
  // o modelo atual (users/roles).
  const { error: uploadError } = await adminClient.storage
    .from('products')
    .upload(storagePath, imageBuffer, {
      contentType,
      cacheControl: `${60 * 60 * 24 * 30}`,
      upsert: true,
    })

  if (uploadError) return { error: uploadError.message }

  const { data: publicUrl } = adminClient.storage
    .from('products')
    .getPublicUrl(storagePath)

  // Produto já existe (edição): persiste o novo image_url na hora, em vez de
  // depender do usuário clicar "Salvar" no formulário depois — mesmo padrão
  // já usado por removeProductImage (remove e já limpa o banco imediatamente).
  if (productId) {
    await adminClient
      .from('products')
      .update({ image_url: publicUrl.publicUrl })
      .eq('id', productId)
  }

  return { url: publicUrl.publicUrl }
}

/**
 * Remove a imagem de um produto:
 * 1. Apaga o arquivo do Supabase Storage
 * 2. Limpa o campo image_url no banco
 */
export async function removeProductImage(
  productId: string,
): Promise<{ success?: boolean; error?: string }> {
  // Client admin pelo mesmo motivo do updateProduct: a RLS de `products`
  // depende de `profiles` legada e descartava este UPDATE em silêncio.
  const { adminClient } = await requireProductAccessContext()
  const role = await getCurrentUserRole()

  if (role !== 'admin') {
    return { error: 'Sem permissao para remover imagens.' }
  }

  // Busca a URL atual para saber qual arquivo apagar do storage
  const { data: product } = await adminClient
    .from('products')
    .select('image_url')
    .eq('id', productId)
    .single()

  if (product?.image_url) {
    // Extrai o path relativo dentro do bucket 'products'
    // URL formato: https://<proj>.supabase.co/storage/v1/object/public/products/products/product-{id}.webp
    try {
      const urlObj = new URL(product.image_url)
      const pathParts = urlObj.pathname.split('/storage/v1/object/public/products/')
      if (pathParts.length === 2 && pathParts[1]) {
        // Ver nota em uploadProductImage sobre a policy de storage legada.
        await adminClient.storage.from('products').remove([pathParts[1]])
      }
    } catch {
      // Se falhar ao apagar do storage, continua para limpar o banco
    }
  }

  // Limpa image_url no banco
  const { error } = await adminClient
    .from('products')
    .update({ image_url: null })
    .eq('id', productId)

  if (error) return { error: error.message }

  revalidatePath('/empresario/produtos')
  revalidatePath(`/empresario/produtos/editar/${productId}`)
  return { success: true }
}

