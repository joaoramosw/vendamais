'use client'

import { deactivateUser, reactivateUser, softDeleteUser, updateUserRole, updateUserSegmento, resetUserPassword, type AdminUserView } from '@/actions/admin-users'
import type { SegmentoWithCount } from '@/actions/fornecedor-segmentos'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import type { RoleKey } from '@/lib/types/database'
import { formatPhoneBR } from '@/lib/phone'
import { shareViaWhatsApp } from '@/lib/whatsapp'
import { Check, ChevronDown, Copy, KeyRound, MessageCircle, Pencil, Trash2, UserCheck, UserCog, UserX } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

const ROLE_OPTIONS: { value: RoleKey; label: string }[] = [
  { value: 'admin', label: ROLE_LABELS.admin },
  { value: 'supplier', label: ROLE_LABELS.supplier },
]

function RoleBadge({ role }: { role: RoleKey }) {
  const map: Record<RoleKey, { label: string; cls: string }> = {
    admin: { label: 'Admin', cls: 'bg-primary-500/15 text-primary-400 border-primary-500/20' },
    supplier: { label: 'Fornecedor', cls: 'bg-success-500/15 text-success-400 border-success-500/20' },
  }
  const config = map[role]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${config.cls}`}>
      {config.label}
    </span>
  )
}

function UserRow({ user, segmentos }: { user: AdminUserView; segmentos: SegmentoWithCount[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [role, setRole] = useState<RoleKey>(user.role)
  const [segmentoId, setSegmentoId] = useState<string>(user.segmento_id ?? '')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [resetResult, setResetResult] = useState<{
    username: string | null
    temporaryPassword: string | null
    whatsapp: string | null
  } | null>(null)
  const [copiedField, setCopiedField] = useState<'telefone' | 'password' | null>(null)
  const roleDirty = role !== user.role

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setRole(e.target.value as RoleKey)
  }

  function handleSegmentoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    setSegmentoId(value)
    startTransition(async () => {
      const res = await updateUserSegmento(user.id, value || null)
      setStatus(res.success ? 'success' : 'error')
      setStatusMsg(res.error ?? 'Segmento atualizado!')
      setTimeout(() => setStatus('idle'), 2500)
    })
  }

  function handleSaveRole() {
    startTransition(async () => {
      const res = await updateUserRole(user.id, role)
      setStatus(res.success ? 'success' : 'error')
      setStatusMsg(res.error ?? 'Papel atualizado!')
      setTimeout(() => setStatus('idle'), 2500)
    })
  }

  function handleDeactivate() {
    if (!confirm(`Desativar ${user.nome}? O usuario nao conseguira mais fazer login.`)) return
    startTransition(async () => {
      const res = await deactivateUser(user.id)
      setStatus(res.success ? 'success' : 'error')
      setStatusMsg(res.error ?? 'Usuario desativado.')
      setTimeout(() => setStatus('idle'), 2500)
      if (res.success) router.refresh()
    })
  }

  function handleSoftDelete() {
    if (!confirm(`Excluir ${user.nome}? O usuario some das listagens, mas o registro fica guardado.`)) return
    startTransition(async () => {
      const res = await softDeleteUser(user.id)
      if (res.success) {
        router.refresh()
      } else {
        setStatus('error')
        setStatusMsg(res.error ?? 'Erro ao excluir usuario.')
        setTimeout(() => setStatus('idle'), 2500)
      }
    })
  }

  function handleReactivate() {
    startTransition(async () => {
      const res = await reactivateUser(user.id)
      setStatus(res.success ? 'success' : 'error')
      setStatusMsg(res.error ?? 'Usuario reativado.')
      setTimeout(() => setStatus('idle'), 2500)
      if (res.success) router.refresh()
    })
  }

  function handleResetPassword() {
    setResetResult(null)
    startTransition(async () => {
      const res = await resetUserPassword(user.id)
      if (res.error) {
        setStatus('error')
        setStatusMsg(res.error ?? 'Nao foi possivel redefinir a senha.')
        setTimeout(() => setStatus('idle'), 2500)
        return
      }
      setResetResult({
        username: res.username,
        temporaryPassword: res.temporaryPassword,
        whatsapp: res.whatsapp,
      })
    })
  }

  async function handleCopy(field: 'telefone' | 'password', value: string) {
    await navigator.clipboard.writeText(value)
    setCopiedField(field)
    window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1600)
  }

  function handleSendCredentialsWhatsApp() {
    if (!resetResult?.temporaryPassword) return
    const loginUrl = `${window.location.origin}/login`
    const telefone = resetResult.whatsapp ?? user.telefone
    shareViaWhatsApp(
      `Olá ${user.nome}! Sua senha de acesso à VendaMais foi redefinida.\n\nTelefone: ${telefone ? formatPhoneBR(telefone) : '—'}\nSenha provisória: ${resetResult.temporaryPassword}\n\nAcesse ${loginUrl} — você vai precisar trocar a senha no primeiro acesso.`,
      telefone,
    )
  }

  return (
    <>
      <tr className="border-b border-neutral-100 dark:border-white/[0.04] hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-xs font-bold shrink-0 uppercase">
            {user.nome?.charAt(0) || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-200 truncate">{user.nome}</p>
            {user.username && (
              <p className="text-xs text-neutral-500">@{user.username}</p>
            )}
          </div>
        </div>
      </td>
      {/* Identificador da conta = telefone. O e-mail é sintético desde a
          migração para auth por telefone e nunca vai pra tela (src/lib/phone.ts). */}
      <td className="px-5 py-4 text-sm text-neutral-400 max-w-[200px] truncate">
        {user.telefone ? (
          formatPhoneBR(user.telefone)
        ) : (
          <span className="text-warning-600 dark:text-warning-500" title="Sem telefone, esta conta não consegue fazer login">
            sem telefone
          </span>
        )}
      </td>
      <td className="px-5 py-4">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-5 py-4">
        <div className="relative min-w-[140px]">
          <select
            value={role}
            onChange={handleRoleChange}
            disabled={isPending}
            className="w-full appearance-none text-xs bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200 dark:border-white/[0.1] text-neutral-700 dark:text-neutral-300 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-1 focus:ring-primary-500/50 cursor-pointer disabled:opacity-50"
          >
            {ROLE_OPTIONS.map(o => (
              <option key={o.value} value={o.value} className="bg-neutral-800">{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-500 pointer-events-none" />
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          {roleDirty && (
            <button
              onClick={handleSaveRole}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 rounded-lg border border-primary-500/20 transition-colors disabled:opacity-40 cursor-pointer"
              title="Salvar papel"
            >
              <UserCog className="h-3.5 w-3.5" />
              Salvar
            </button>
          )}
          <Link
            href={`/empresario/usuarios/${user.id}/editar`}
            className="flex items-center gap-1 p-1.5 text-xs bg-neutral-100 dark:bg-white/[0.05] hover:bg-neutral-200 dark:hover:bg-white/[0.1] text-neutral-500 dark:text-neutral-400 rounded-lg border border-neutral-200 dark:border-white/[0.1] transition-colors cursor-pointer"
            title="Editar informacoes"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          {!user.banned && (
            <button
              onClick={handleDeactivate}
              disabled={isPending}
              className="flex items-center gap-1 p-1.5 text-xs bg-danger-500/10 hover:bg-danger-500/20 text-danger-400 rounded-lg border border-danger-500/20 transition-colors disabled:opacity-40 cursor-pointer"
              title="Desativar usuario"
            >
              <UserX className="h-3.5 w-3.5" />
            </button>
          )}
          {user.banned && (
            <button
              onClick={handleReactivate}
              disabled={isPending}
              className="flex items-center gap-1 p-1.5 text-xs bg-success-500/10 hover:bg-success-500/20 text-success-400 rounded-lg border border-success-500/20 transition-colors disabled:opacity-40 cursor-pointer"
              title="Reativar usuario"
            >
              <UserCheck className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={handleResetPassword}
            disabled={isPending}
            className="flex items-center gap-1 p-1.5 text-xs bg-info-500/10 hover:bg-info-500/20 text-info-400 rounded-lg border border-info-500/20 transition-colors disabled:opacity-40 cursor-pointer"
            title="Redefinir senha"
          >
            <KeyRound className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleSoftDelete}
            disabled={isPending}
            className="flex items-center gap-1 p-1.5 text-xs bg-danger-500/10 hover:bg-danger-500/20 text-danger-400 rounded-lg border border-danger-500/20 transition-colors disabled:opacity-40 cursor-pointer"
            title="Excluir usuario"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {status !== 'idle' && (
          <p className={`text-[10px] mt-1.5 ${status === 'success' ? 'text-success-400' : 'text-danger-400'}`}>
            {statusMsg}
          </p>
        )}
      </td>
      <td className="px-5 py-4 text-xs text-neutral-500 max-w-[140px] truncate">
        {user.organization_name ?? '—'}
      </td>
      <td className="px-5 py-4">
        {role === 'supplier' ? (
          <div className="relative min-w-[140px]">
            <select
              value={segmentoId}
              onChange={handleSegmentoChange}
              disabled={isPending}
              className="w-full appearance-none text-xs bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200 dark:border-white/[0.1] text-neutral-700 dark:text-neutral-300 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-1 focus:ring-primary-500/50 cursor-pointer disabled:opacity-50"
            >
              <option value="" className="bg-neutral-800">Sem segmento</option>
              {segmentos.map(s => (
                <option key={s.id} value={s.id} className="bg-neutral-800">{s.nome}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-500 pointer-events-none" />
          </div>
        ) : (
          <span className="text-xs text-neutral-600">—</span>
        )}
      </td>
      <td className="px-5 py-4 text-xs text-neutral-600 whitespace-nowrap">
        {new Date(user.created_at).toLocaleDateString('pt-BR')}
      </td>
    </tr>

    {resetResult && (
      <tr className="border-b border-neutral-100 dark:border-white/[0.04]">
        <td colSpan={8} className="px-5 py-4">
          <div className="rounded-lg border border-info-500/20 bg-info-500/5 px-4 py-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-info-700 dark:text-info-300">
              <KeyRound className="h-4 w-4" />
              Senha redefinida
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Compartilhe as credenciais abaixo com {user.nome}. No primeiro login, a senha deverá ser
              trocada.
            </p>

            {/* O login é por telefone — é ele que vai na credencial, não o
                @username (que virou só rótulo interno). */}
            {(resetResult.whatsapp ?? user.telefone) && (
              <div className="space-y-1">
                <span className="text-[11px] text-neutral-500 font-medium">Telefone (login)</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-md border border-info-500/20 bg-neutral-100 dark:bg-black/20 px-2.5 py-2 text-[11px] text-info-700 dark:text-info-200 break-all font-mono">
                    {formatPhoneBR(resetResult.whatsapp ?? user.telefone)}
                  </div>
                  <button
                    onClick={() =>
                      handleCopy('telefone', formatPhoneBR(resetResult.whatsapp ?? user.telefone))
                    }
                    className="shrink-0 rounded-md border border-info-500/25 p-2 text-info-300 hover:bg-info-500/10 cursor-pointer"
                    title="Copiar telefone"
                  >
                    {copiedField === 'telefone' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {resetResult.temporaryPassword && (
              <div className="space-y-1">
                <span className="text-[11px] text-neutral-500 font-medium">Senha provisória</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-md border border-info-500/20 bg-neutral-100 dark:bg-black/20 px-2.5 py-2 text-[11px] text-info-700 dark:text-info-200 break-all font-mono">
                    {resetResult.temporaryPassword}
                  </div>
                  <button
                    onClick={() => handleCopy('password', resetResult.temporaryPassword!)}
                    className="shrink-0 rounded-md border border-info-500/25 p-2 text-info-300 hover:bg-info-500/10 cursor-pointer"
                    title="Copiar senha"
                  >
                    {copiedField === 'password' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleSendCredentialsWhatsApp}
                disabled={!(resetResult.whatsapp ?? user.telefone)}
                className="flex items-center gap-1.5 rounded-md border border-success-500/25 bg-success-500/15 px-3 py-2 text-xs font-medium text-success-100 hover:bg-success-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                title={(resetResult.whatsapp ?? user.telefone) ? 'Enviar credenciais por WhatsApp' : 'Usuário sem telefone cadastrado'}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Enviar por WhatsApp
              </button>
              {!(resetResult.whatsapp ?? user.telefone) && (
                <span className="text-[11px] text-neutral-500">
                  Usuário sem telefone cadastrado — envie as credenciais manualmente.
                </span>
              )}
            </div>
          </div>
        </td>
      </tr>
    )}
    </>
  )
}

interface UsersTableProps {
  users: AdminUserView[]
  segmentos: SegmentoWithCount[]
}

export function UsersTable({ users, segmentos }: UsersTableProps) {
  const [search, setSearch] = useState('')

  const termo = search.toLowerCase()
  // Busca por telefone compara só dígitos: quem digita "71 99999" acha o
  // número gravado como 5571999999999.
  const digitosBusca = search.replace(/\D/g, '')

  const filtered = users.filter(u =>
    u.nome.toLowerCase().includes(termo) ||
    (u.username ?? '').toLowerCase().includes(termo) ||
    (!!digitosBusca && (u.telefone ?? '').includes(digitosBusca))
  )

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-white/[0.06] overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/[0.06]">
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou @username..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm text-sm bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200 dark:border-white/[0.08] text-neutral-900 dark:text-neutral-300 placeholder-neutral-500 dark:placeholder-neutral-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500/40"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-white/[0.06]">
              {['Usuario', 'Telefone', 'Papel atual', 'Editar papel', 'Acoes', 'Empresa', 'Segmento', 'Cadastro'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-neutral-500 dark:text-neutral-600">
                  Nenhum usuario encontrado.
                </td>
              </tr>
            ) : (
              filtered.map(user => <UserRow key={user.id} user={user} segmentos={segmentos} />)
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-white/[0.06] text-xs text-neutral-500 dark:text-neutral-600">
          {filtered.length} {filtered.length === 1 ? 'usuario' : 'usuarios'}
        </div>
      )}
    </div>
  )
}
