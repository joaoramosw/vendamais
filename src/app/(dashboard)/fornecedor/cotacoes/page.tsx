import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FornecedorConvitesClient } from "@/components/cotacoes/FornecedorConvitesClient";

export default async function CotacoesDisponiveisPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Dados buscados no client via o backend novo (GET /fornecedor/convites) —
  // a query antiga aqui usava profiles:empresario_id e propostas.fornecedor_id,
  // nenhum dos dois existe no schema real (ver CLAUDE.md e o plano desta sessão).
  return <FornecedorConvitesClient />;
}
