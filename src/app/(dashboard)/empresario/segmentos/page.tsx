import { getSegmentos } from "@/actions/fornecedor-segmentos";
import { SegmentosTable } from "@/components/usuarios/SegmentosTable";
import { ToastContainer } from "@/components/ui/toast";
import { getCurrentUserRole } from "@/lib/roles.server";
import { redirect } from "next/navigation";

export default async function SegmentosPage() {
  const role = await getCurrentUserRole();

  if (role === "supplier") {
    redirect("/fornecedor/dashboard");
  }

  const { segmentos } = await getSegmentos();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">Segmentos</h1>
          <p className="text-neutral-400 font-medium mt-1">
            Classifique seus fornecedores em segmentos pra convidar em massa na
            hora de criar uma cotação.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1.5 shrink-0">
          <span className="text-xs font-bold text-neutral-500 bg-white/[0.04] border border-white/[0.06] px-3 py-1 rounded-full">
            {segmentos.length.toLocaleString("pt-BR")}{" "}
            {segmentos.length === 1 ? "segmento" : "segmentos"}
          </span>
        </div>
      </div>

      <SegmentosTable segmentos={segmentos} />

      <ToastContainer />
    </div>
  );
}
