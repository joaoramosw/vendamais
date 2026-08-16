import { MinhasPropostasClient } from "@/components/propostas/MinhasPropostasClient"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function MinhasPropostasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; aberta?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { status, aberta } = await searchParams

  if (!user) {
    const target = aberta
      ? `/fornecedor/propostas?aberta=${aberta}`
      : "/fornecedor/propostas"
    redirect(`/login?redirect=${encodeURIComponent(target)}`)
  }

  return <MinhasPropostasClient initialStatus={status} initialAbertaId={aberta} />
}
