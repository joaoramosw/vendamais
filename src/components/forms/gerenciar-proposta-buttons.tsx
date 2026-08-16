"use client"

import { gerenciarProposta } from "@/actions/propostas"
import { showToast } from "@/components/ui/toast"
import { CheckCircle, Inbox, Loader2, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function GerenciarPropostaButtons({
  propostaId,
  currentStatus,
}: {
  propostaId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<"recebida" | "aceita" | "recusada" | null>(null)

  async function handleAction(status: "recebida" | "aceita" | "recusada") {
    setLoading(true)
    setConfirmAction(null)
    try {
      const result = await gerenciarProposta(propostaId, status)
      if (result?.error) {
        showToast(result.error, "error")
      } else {
        const messages: Record<string, string> = {
          recebida: "Proposta marcada como recebida!",
          aceita: "Proposta aceita com sucesso! Cotação encerrada.",
          recusada: "Proposta recusada.",
        }
        const toastTypes: Record<string, "success" | "info"> = {
          recebida: "info",
          aceita: "success",
          recusada: "info",
        }
        showToast(messages[status], toastTypes[status] || "info")
        // Refresh the page to reflect updated statuses
        router.refresh()
      }
    } catch {
      showToast("Erro ao processar a proposta.", "error")
    }
    setLoading(false)
  }

  // Determine available actions based on current status
  const isEnviada = currentStatus === "enviada"
  const isRecebida = currentStatus === "recebida"
  const isFinal = currentStatus === "aceita" || currentStatus === "recusada"

  if (isFinal) return null

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Step 1: Mark as received (only when status is 'enviada') */}
        {isEnviada && (
          <button
            onClick={() => setConfirmAction("recebida")}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-info-500/10 text-info-400 rounded-[var(--radius-md)] text-sm font-medium hover:bg-info-500/20 transition-all disabled:opacity-50 cursor-pointer border border-info-500/20"
          >
            {loading && confirmAction === "recebida" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Inbox className="h-4 w-4" />
            )}
            Marcar como Recebida
          </button>
        )}

        {/* Step 2: Accept / Refuse (only when status is 'recebida') */}
        {isRecebida && (
          <>
            <button
              onClick={() => setConfirmAction("aceita")}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-success-500/15 text-success-400 rounded-[var(--radius-md)] text-sm font-bold hover:bg-success-500/25 transition-all disabled:opacity-50 cursor-pointer border border-success-500/20"
            >
              {loading && confirmAction === "aceita" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Aceitar Proposta
            </button>
            <button
              onClick={() => setConfirmAction("recusada")}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-500/10 text-rose-400 rounded-[var(--radius-md)] text-sm font-medium hover:bg-rose-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading && confirmAction === "recusada" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Recusar
            </button>
          </>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-neutral-900 border border-white/[0.08] rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-scale-in">
            <div className="text-center space-y-4">
              <div
                className={`h-14 w-14 mx-auto rounded-full flex items-center justify-center ${
                  confirmAction === "aceita"
                    ? "bg-success-500/15 text-success-400"
                    : confirmAction === "recebida"
                    ? "bg-info-500/15 text-info-400"
                    : "bg-rose-500/15 text-rose-400"
                }`}
              >
                {confirmAction === "aceita" ? (
                  <CheckCircle className="h-7 w-7" />
                ) : confirmAction === "recebida" ? (
                  <Inbox className="h-7 w-7" />
                ) : (
                  <XCircle className="h-7 w-7" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {confirmAction === "aceita"
                    ? "Aceitar Proposta?"
                    : confirmAction === "recebida"
                    ? "Confirmar Recebimento?"
                    : "Recusar Proposta?"}
                </h3>
                <p className="text-sm text-neutral-400 mt-1">
                  {confirmAction === "aceita"
                    ? "Esta ação aceita formalmente a proposta do fornecedor."
                    : confirmAction === "recebida"
                    ? "Marque que você recebeu fisicamente este pedido."
                    : "Essa proposta será marcada como recusada."}
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-medium text-neutral-400 bg-white/[0.05] hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleAction(confirmAction)}
                  disabled={loading}
                  className={`flex-1 px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-bold transition-all cursor-pointer disabled:opacity-50 ${
                    confirmAction === "aceita"
                      ? "bg-success-600 hover:bg-success-500 text-white"
                      : confirmAction === "recebida"
                      ? "bg-info-600 hover:bg-info-500 text-white"
                      : "bg-rose-600 hover:bg-rose-500 text-white"
                  }`}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : confirmAction === "aceita" ? (
                    "Sim, Aceitar"
                  ) : confirmAction === "recebida" ? (
                    "Confirmar"
                  ) : (
                    "Sim, Recusar"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
