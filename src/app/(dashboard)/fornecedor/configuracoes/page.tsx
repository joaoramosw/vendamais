import { getOwnProfile } from "@/actions/profiles"
import { OwnProfileForm } from "@/components/configuracoes/OwnProfileForm"
import { Settings } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ConfiguracoesPage() {
  const { profile, error } = await getOwnProfile()

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary-400" />
          Configurações
        </h1>
        <p className="text-neutral-400 font-medium mt-1">
          Gerencie suas informações de perfil.
        </p>
      </div>

      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 rounded-xl px-5 py-4 text-sm text-danger-400">
          Erro ao carregar perfil: {error}
        </div>
      )}

      {profile && <OwnProfileForm profile={profile} />}
    </div>
  )
}
