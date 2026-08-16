import { redirect } from "next/navigation";
import { FORNECEDOR_LANDING_PATH } from "@/lib/routes";

/** Landing do papel Fornecedor: Cotações Ativas (ver src/lib/routes.ts). */
export default function FornecedorIndexPage() {
  redirect(FORNECEDOR_LANDING_PATH);
}
