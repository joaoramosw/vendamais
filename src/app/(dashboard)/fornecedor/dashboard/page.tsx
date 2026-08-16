import { getDashboardFornecedor } from "@/actions/dashboard";
import { redirect } from "next/navigation";
import { FORNECEDOR_DASHBOARD_HABILITADO, FORNECEDOR_LANDING_PATH } from "@/lib/routes";
import { FornecedorDashboardContent } from "./dashboard-content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Dashboard do fornecedor — **desativado por decisão de produto**.
 *
 * Nada foi deletado: a rota, o carregamento de dados (`getDashboardFornecedor`)
 * e a tela inteira (`dashboard-content.tsx`) continuam aqui. Enquanto
 * `FORNECEDOR_DASHBOARD_HABILITADO` for `false` (src/lib/routes.ts), qualquer
 * acesso cai em "Cotações Ativas", que passou a ser a landing do papel — e o
 * item some da sidebar. Virar a flag para `true` devolve tudo, sem outra
 * mudança de código.
 */
export default async function FornecedorDashboardPage() {
  if (!FORNECEDOR_DASHBOARD_HABILITADO) {
    redirect(FORNECEDOR_LANDING_PATH);
  }

  const data = await getDashboardFornecedor();

  return <FornecedorDashboardContent data={data} />;
}
