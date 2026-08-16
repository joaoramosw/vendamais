import { DraftListClient } from "@/components/cotacoes/DraftListClient";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Lista de Cotação | Venda Mais",
  description: "Monte sua lista de cotação e envie aos fornecedores.",
};

export default async function ListaCotacaoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userName = "Usuário";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", user.id)
      .single();
    userName = profile?.nome || userName;
  }

  return <DraftListClient userName={userName} />;
}
