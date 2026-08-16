'use client'

import { createUserWithProvisionalPassword } from '@/actions/admin-users'
import type { RoleKey } from '@/lib/types/database'
import { formatPhoneBR } from '@/lib/phone'
import { shareViaWhatsApp } from '@/lib/whatsapp'
import { Check, Copy, Loader2, MessageCircle, UserPlus, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { UserForm } from './UserForm'

export function InviteUserModal() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [copiedField, setCopiedField] = useState<'telefone' | 'password' | 'link' | null>(null)
  const [result, setResult] = useState<{
    success?: boolean
    error?: string | null
    username?: string | null
    telefone?: string | null
    temporaryPassword?: string | null
    loginPath?: string | null
  } | null>(null)

  const [form, setForm] = useState({
    telefone: '',
    nome: '',
    username: '',
    role: 'supplier' as RoleKey,
    organizationName: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleCopy(field: 'telefone' | 'password' | 'link', value: string) {
    await navigator.clipboard.writeText(value)
    setCopiedField(field)
    window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1600)
  }

  function handleShareCredentials() {
    if (!result?.telefone || !result?.temporaryPassword || !result?.loginPath) return
    const loginUrl = `${window.location.origin}${result.loginPath}`
    // O login é por telefone — mandar "usuário" aqui só confundiria.
    shareViaWhatsApp(
      `Acesse ${loginUrl}\nTelefone: ${formatPhoneBR(result.telefone)}\nSenha provisória: ${result.temporaryPassword}\n\nVocê vai precisar trocar a senha no primeiro login.`,
      result.telefone,
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await createUserWithProvisionalPassword({
        telefone: form.telefone,
        nome: form.nome,
        username: form.username,
        role: form.role,
        organizationName: form.organizationName || undefined,
      })

      if (res.error) {
        setResult({ success: false, error: res.error })
      } else {
        setResult({
          success: true,
          error: null,
          username: res.username,
          telefone: res.telefone,
          temporaryPassword: res.temporaryPassword,
          loginPath: res.loginPath,
        })
        setForm({ telefone: '', nome: '', username: '', role: 'supplier', organizationName: '' })
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors cursor-pointer"
      >
        <UserPlus className="h-4 w-4" />
        Criar usuário
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-neutral-900 border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Criar novo usuário</h2>
              <button onClick={() => setOpen(false)} className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <UserForm mode="create" values={form} onChange={handleChange} />

              <p className="text-xs text-neutral-500">
                A conta é criada na hora, com uma senha provisória gerada pelo sistema. Compartilhe o
                usuário e a senha abaixo com a pessoa — ela poderá trocar a senha depois de logar.
              </p>

              {result?.error && (
                <p className="text-xs text-danger-400 bg-danger-500/10 border border-danger-500/20 rounded-lg px-3 py-2">
                  {result.error}
                </p>
              )}
              {result?.success && (
                <div className="space-y-3 rounded-lg border border-success-500/20 bg-success-500/10 px-3 py-3 text-xs text-success-300">
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="h-4 w-4" />
                    Usuário criado com sucesso.
                  </div>
                  <p className="text-success-200/90">
                    Encaminhe estas credenciais por WhatsApp ou outro canal seguro:
                  </p>
                  <button
                    type="button"
                    onClick={handleShareCredentials}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-success-500/25 bg-success-500/15 px-3 py-2 text-success-100 hover:bg-success-500/25 transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Enviar por WhatsApp
                  </button>
                  {result.telefone && (
                    <div className="space-y-1">
                      <span className="text-success-200/70">Telefone (login)</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-md border border-success-500/20 bg-black/20 px-2.5 py-2 text-[11px] text-success-100 break-all">
                          {formatPhoneBR(result.telefone)}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy('telefone', formatPhoneBR(result.telefone!))}
                          className="shrink-0 rounded-md border border-success-500/25 p-2 text-success-100 hover:bg-success-500/10"
                        >
                          {copiedField === 'telefone' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                  {result.temporaryPassword && (
                    <div className="space-y-1">
                      <span className="text-success-200/70">Senha provisória</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-md border border-success-500/20 bg-black/20 px-2.5 py-2 text-[11px] text-success-100 break-all font-mono">
                          {result.temporaryPassword}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy('password', result.temporaryPassword!)}
                          className="shrink-0 rounded-md border border-success-500/25 p-2 text-success-100 hover:bg-success-500/10"
                        >
                          {copiedField === 'password' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                  {result.loginPath && (
                    <div className="space-y-1">
                      <span className="text-success-200/70">Link de acesso</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-md border border-success-500/20 bg-black/20 px-2.5 py-2 text-[11px] text-success-100 break-all">
                          {typeof window !== 'undefined' ? `${window.location.origin}${result.loginPath}` : result.loginPath}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              'link',
                              typeof window !== 'undefined'
                                ? `${window.location.origin}${result.loginPath}`
                                : result.loginPath!
                            )
                          }
                          className="shrink-0 rounded-md border border-success-500/25 p-2 text-success-100 hover:bg-success-500/10"
                        >
                          {copiedField === 'link' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="text-success-200/60">
                    No primeiro login a pessoa será obrigada a trocar a senha.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 px-4 py-2.5 text-sm text-neutral-400 border border-white/[0.08] rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {isPending ? 'Criando...' : 'Criar usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
