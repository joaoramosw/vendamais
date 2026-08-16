'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { emailExibivel } from '@/lib/convite-contato'
import { redirect } from 'next/navigation'

// ── Types ──

export interface DashboardStat {
  label: string
  value: number
  href: string
  icon: string // lucide icon name
  color: string
  bgColor: string
}

export interface ActivityItem {
  id: string
  type: 'cotacao_criada' | 'proposta_recebida' | 'cotacao_encerrada' | 'proposta_enviada' | 'proposta_aceita'
  title: string
  description: string
  created_at: string
}

export interface ChartDataPoint {
  label: string
  value: number
}

export interface EmpresarioDashboardData {
  userName: string
  stats: DashboardStat[]
  chartData: ChartDataPoint[]
  recentActivity: ActivityItem[]
  cotacoesAbertas: number
  cotacoesFechadas: number
  totalItensCotacoes: number
  totalProdutos: number
  totalCategorias: number
  totalSegmentos: number
}

export interface FornecedorDashboardData {
  userName: string
  stats: DashboardStat[]
  chartData: ChartDataPoint[]
  recentActivity: ActivityItem[]
  cotacoesDisponiveis: number
  propostasStatusCounts: {
    pendente: number
    aceita: number
    recusada: number
  }
  propostasResumo: Array<{
    id: string
    status: string
    valor_total: number | null
    created_at: string
    cotacao_titulo: string | null
  }>
}

// ── Helpers ──

function getLast7DaysLabels(): string[] {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const labels: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    labels.push(days[d.getDay()])
  }
  return labels
}

function getDateNDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// fornecedores_convidados.whatsapp guarda o texto livre digitado em
// PropostaForm.tsx (não normalizado, ao contrário de users.whatsapp) — o
// vínculo por telefone só compara os últimos 9 dígitos (DDD + número) via
// ilike, pra tolerar formatação diferente ("(71) 99999-9999" vs dígitos puros).
function buildFornecedorOrFilter(email: string, whatsapp: string | null): string {
  const emailNormalized = email.trim().toLowerCase()
  const parts = [`email_contato.eq.${emailNormalized}`]
  const digits = whatsapp ? whatsapp.replace(/\D/g, '') : ''
  if (digits.length >= 9) {
    parts.push(`whatsapp.ilike.%${digits.slice(-9)}%`)
  }
  return parts.join(',')
}

// ── Empresário Dashboard ──

export async function getDashboardEmpresario(): Promise<EmpresarioDashboardData> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('nome, active_organization_id')
    .eq('id', user.id)
    .single()

  const adminClient = createAdminClient()
  const productCountQuery = adminClient.from('products').select('*', { count: 'exact', head: true })
  const categoryCountQuery = adminClient
    .from('categories')
    .select('*', { count: 'exact', head: true })

  // Mesma fonte de verdade das telas de listagem: tudo que está visível filtra
  // deleted_at IS NULL (soft delete, migration 012) — sem isso os cards contam
  // também os registros excluídos.
  const scopedProductCountQuery = profile?.active_organization_id
    ? productCountQuery.or(
        `organization_id.eq.${profile.active_organization_id},organization_id.is.null`
      ).is('deleted_at', null)
    : productCountQuery.is('organization_id', null).is('deleted_at', null)

  const scopedCategoryCountQuery = profile?.active_organization_id
    ? categoryCountQuery.or(
        `organization_id.eq.${profile.active_organization_id},organization_id.is.null`
      ).is('deleted_at', null)
    : categoryCountQuery.is('organization_id', null).is('deleted_at', null)

  // Stats
  const [totalCotacoesRes, cotacoesAbertasRes, cotacoesFechadasRes, totalPropostasRes, totalProdutosRes, totalCategoriasRes, totalSegmentosRes, cotacaoIdsRes] = await Promise.all([
    supabase
      .from('cotacoes')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', user.id),
    supabase
      .from('cotacoes')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', user.id)
      .eq('status', 'aberta'),
    supabase
      .from('cotacoes')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', user.id)
      .eq('status', 'fechada'),
    // propostas.cotacao_id -> cotacoes.id é FK real, esse embed funciona
    // (ao contrário de qualquer embed envolvendo fornecedor_id/profiles).
    supabase
      .from('propostas')
      .select('*, cotacoes!inner(admin_id)', { count: 'exact', head: true })
      .eq('cotacoes.admin_id', user.id),
    scopedProductCountQuery,
    scopedCategoryCountQuery,
    adminClient.from('segmentos').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    // cotacoes <-> cotacao_itens não tem embed reconhecido pelo PostgREST
    // (ver CLAUDE.md) — conta itens em 2 passos: ids das cotações do admin,
    // depois count direto em cotacao_itens filtrado por esses ids.
    supabase.from('cotacoes').select('id').eq('admin_id', user.id),
  ])

  const totalSegmentos = totalSegmentosRes.count ?? 0

  const totalCotacoes = totalCotacoesRes.count ?? 0
  const cotacoesAbertas = cotacoesAbertasRes.count ?? 0
  const cotacoesFechadas = cotacoesFechadasRes.count ?? 0
  const totalPropostas = totalPropostasRes.count ?? 0
  const totalProdutos = totalProdutosRes.count ?? 0
  const totalCategorias = totalCategoriasRes.count ?? 0

  const cotacaoIds = (cotacaoIdsRes.data || []).map((c) => c.id)
  const totalItensCotacoesRes = cotacaoIds.length > 0
    ? await supabase
        .from('cotacao_itens')
        .select('*', { count: 'exact', head: true })
        .in('cotacao_id', cotacaoIds)
    : null
  const totalItensCotacoes = totalItensCotacoesRes?.count ?? 0

  // Chart - cotações per day (last 7 days)
  const sevenDaysAgo = getDateNDaysAgo(7)
  const { data: recentCotacoes } = await supabase
    .from('cotacoes')
    .select('created_at')
    .eq('admin_id', user.id)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: true })

  const dayLabels = getLast7DaysLabels()
  const chartData: ChartDataPoint[] = dayLabels.map((label, index) => {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - (6 - index))
    const dateStr = targetDate.toISOString().split('T')[0]
    const count = (recentCotacoes || []).filter(
      (c) => c.created_at?.startsWith(dateStr)
    ).length
    return { label, value: count }
  })

  // Recent activity
  const activity: ActivityItem[] = []

  const { data: recentCotacoesActivity } = await supabase
    .from('cotacoes')
    .select('id, titulo, created_at, status')
    .eq('admin_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  for (const c of recentCotacoesActivity || []) {
    if (c.status === 'fechada') {
      activity.push({
        id: `cotacao-enc-${c.id}`,
        type: 'cotacao_encerrada',
        title: 'Cotação finalizada',
        description: c.titulo,
        created_at: c.created_at,
      })
    } else {
      activity.push({
        id: `cotacao-${c.id}`,
        type: 'cotacao_criada',
        title: 'Nova cotação criada',
        description: c.titulo,
        created_at: c.created_at,
      })
    }
  }

  // fornecedores_convidados.email_contato é a única identificação disponível
  // pro fornecedor (sem conta vinculada, ver CLAUDE.md/plano desta sessão) —
  // profiles:fornecedor_id não existe no schema real.
  const { data: recentPropostas } = await supabase
    .from('propostas')
    .select(
      'id, created_at, cotacoes!inner(titulo, admin_id), fornecedores_convidados(email_contato, whatsapp, nome_empresa)'
    )
    .eq('cotacoes.admin_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  for (const p of (recentPropostas as unknown as Array<{
    id: string
    created_at: string
    cotacoes: { titulo: string }
    fornecedores_convidados: {
      email_contato: string | null
      whatsapp: string | null
      nome_empresa: string | null
    } | null
  }>) || []) {
    const convidado = p.fornecedores_convidados
    // email_contato pode ser a sentinela do convite só-WhatsApp — nunca exibir.
    const quem =
      convidado?.nome_empresa ||
      convidado?.whatsapp ||
      emailExibivel(convidado?.email_contato) ||
      'Fornecedor'

    activity.push({
      id: `proposta-${p.id}`,
      type: 'proposta_recebida',
      title: 'Proposta recebida',
      description: `${quem} enviou proposta para "${p.cotacoes?.titulo}"`,
      created_at: p.created_at,
    })
  }

  // Sort by date and take last 5
  activity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return {
    userName: profile?.nome?.split(' ')[0] || 'Usuário',
    stats: [
      {
        label: 'Total de Cotações',
        value: totalCotacoes,
        href: '/empresario/cotacoes',
        icon: 'FileText',
        color: 'text-primary-400',
        bgColor: 'bg-primary-500/10',
      },
      {
        label: 'Cotações Abertas',
        value: cotacoesAbertas,
        href: '/empresario/cotacoes?status=aberta',
        icon: 'TrendingUp',
        color: 'text-success-400',
        bgColor: 'bg-success-500/10',
      },
      {
        label: 'Propostas Recebidas',
        value: totalPropostas,
        href: '/empresario/cotacoes',
        icon: 'Send',
        color: 'text-sky-400',
        bgColor: 'bg-sky-500/10',
      },
    ],
    chartData,
    recentActivity: activity.slice(0, 5),
    cotacoesAbertas,
    cotacoesFechadas,
    totalItensCotacoes,
    totalProdutos,
    totalCategorias,
    totalSegmentos,
  }
}

// ── Fornecedor Dashboard ──

export async function getDashboardFornecedor(): Promise<FornecedorDashboardData> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('nome, whatsapp')
    .eq('id', user.id)
    .single()

  // fornecedores_convidados.email_contato/whatsapp é a única identificação
  // disponível pro fornecedor (sem conta vinculada, ver CLAUDE.md/plano desta
  // sessão) — propostas.fornecedor_id não existe no schema real, mesma ponte
  // usada em getDashboardEmpresario e em backend/src/fornecedor/fornecedor.service.ts.
  const email = user.email ?? ''
  const fornecedorFilter = buildFornecedorOrFilter(email, profile?.whatsapp ?? null)

  // As policies de RLS de propostas/fornecedores_convidados foram desenhadas
  // pro fluxo público por token (/proposta/[token]), não pra um fornecedor
  // autenticado cruzar as próprias propostas por e-mail/whatsapp — com o
  // client de sessão essas queries voltavam 0 linhas mesmo com dados
  // existentes. Usamos o admin client (como já feito acima pra
  // products/categories) porque o filtro vem da própria sessão verificada
  // (user.email/profile.whatsapp), não de input do cliente.
  const adminClient = createAdminClient()

  // Stats
  const [cotacoesDisponiveisRes, minhasPropostasRes, propostasAceitasRes, propostasRecusadasRes] = await Promise.all([
    supabase
      .from('cotacoes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'aberta'),
    adminClient
      .from('propostas')
      .select('*, fornecedores_convidados!inner(email_contato, whatsapp)', { count: 'exact', head: true })
      .or(fornecedorFilter, { referencedTable: 'fornecedores_convidados' }),
    adminClient
      .from('propostas')
      .select('*, fornecedores_convidados!inner(email_contato, whatsapp)', { count: 'exact', head: true })
      .or(fornecedorFilter, { referencedTable: 'fornecedores_convidados' })
      .eq('status', 'aceita'),
    adminClient
      .from('propostas')
      .select('*, fornecedores_convidados!inner(email_contato, whatsapp)', { count: 'exact', head: true })
      .or(fornecedorFilter, { referencedTable: 'fornecedores_convidados' })
      .eq('status', 'recusada'),
  ])

  const cotacoesDisponiveis = cotacoesDisponiveisRes.count ?? 0
  const minhasPropostas = minhasPropostasRes.count ?? 0
  const propostasAceitas = propostasAceitasRes.count ?? 0
  const propostasRecusadas = propostasRecusadasRes.count ?? 0
  const propostasPendentes = Math.max(minhasPropostas - propostasAceitas - propostasRecusadas, 0)

  // Chart - propostas per day (last 7 days)
  const sevenDaysAgo = getDateNDaysAgo(7)
  const { data: recentPropostasChart } = await adminClient
    .from('propostas')
    .select('created_at, fornecedores_convidados!inner(email_contato, whatsapp)')
    .or(fornecedorFilter, { referencedTable: 'fornecedores_convidados' })
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: true })

  const dayLabels = getLast7DaysLabels()
  const chartData: ChartDataPoint[] = dayLabels.map((label, index) => {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - (6 - index))
    const dateStr = targetDate.toISOString().split('T')[0]
    const count = (recentPropostasChart || []).filter(
      (p) => p.created_at?.startsWith(dateStr)
    ).length
    return { label, value: count }
  })

  // Recent activity
  const activity: ActivityItem[] = []

  const { data: recentPropostas } = await adminClient
    .from('propostas')
    .select('id, created_at, status, cotacoes:cotacao_id(titulo), fornecedores_convidados!inner(email_contato, whatsapp)')
    .or(fornecedorFilter, { referencedTable: 'fornecedores_convidados' })
    .order('created_at', { ascending: false })
    .limit(5)

  for (const p of (recentPropostas as unknown as Array<{
    id: string
    created_at: string
    status: string
    cotacoes: { titulo: string }
  }>) || []) {
    if (p.status === 'aceita') {
      activity.push({
        id: `proposta-aceita-${p.id}`,
        type: 'proposta_aceita',
        title: 'Proposta aceita!',
        description: p.cotacoes?.titulo || 'Cotação',
        created_at: p.created_at,
      })
    } else {
      activity.push({
        id: `proposta-enviada-${p.id}`,
        type: 'proposta_enviada',
        title: 'Proposta enviada',
        description: p.cotacoes?.titulo || 'Cotação',
        created_at: p.created_at,
      })
    }
  }

  activity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const { data: propostasResumoRaw } = await adminClient
    .from('propostas')
    .select('id, status, valor_total, created_at, cotacoes:cotacao_id(titulo), fornecedores_convidados!inner(email_contato, whatsapp)')
    .or(fornecedorFilter, { referencedTable: 'fornecedores_convidados' })
    .order('created_at', { ascending: false })
    .limit(5)

  const propostasResumo = ((propostasResumoRaw as unknown as Array<{
    id: string
    status: string
    valor_total: number | null
    created_at: string
    cotacoes: { titulo: string | null } | null
  }>) || []).map((p) => ({
    id: p.id,
    status: p.status,
    valor_total: p.valor_total ?? null,
    created_at: p.created_at,
    cotacao_titulo: p.cotacoes?.titulo ?? null,
  }))

  return {
    userName: profile?.nome?.split(' ')[0] || 'Usuário',
    stats: [
      {
        label: 'Cotações Disponíveis',
        value: cotacoesDisponiveis,
        href: '/fornecedor/cotacoes',
        icon: 'Search',
        color: 'text-primary-400',
        bgColor: 'bg-primary-500/10',
      },
      {
        label: 'Propostas Enviadas',
        value: minhasPropostas,
        href: '/fornecedor/propostas',
        icon: 'Send',
        color: 'text-sky-400',
        bgColor: 'bg-sky-500/10',
      },
      {
        label: 'Propostas Aceitas',
        value: propostasAceitas,
        href: '/fornecedor/propostas?status=aceita',
        icon: 'TrendingUp',
        color: 'text-success-400',
        bgColor: 'bg-success-500/10',
      },
    ],
    chartData,
    recentActivity: activity.slice(0, 5),
    cotacoesDisponiveis,
    propostasStatusCounts: {
      pendente: propostasPendentes,
      aceita: propostasAceitas,
      recusada: propostasRecusadas,
    },
    propostasResumo,
  }
}
