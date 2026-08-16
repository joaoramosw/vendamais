import { getCategories } from "@/actions/categories";
import { CategoriesTable } from "@/components/categorias/CategoriesTable";
import { ToastContainer } from "@/components/ui/toast";
import { getCurrentUserRole } from "@/lib/roles.server";
import { redirect } from "next/navigation";

export default async function CategoriasPage() {
  const role = await getCurrentUserRole();

  if (role === "supplier") {
    redirect("/fornecedor/dashboard");
  }

  const { categories } = await getCategories();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
            Categorias
          </h1>
          <p className="text-neutral-400 font-medium mt-1">
            Gerencie as categorias dos seus produtos. Organize e agrupe para
            facilitar cotações.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1.5 shrink-0">
          <span className="text-xs font-bold text-neutral-500 bg-white/[0.04] border border-white/[0.06] px-3 py-1 rounded-full">
            {categories.length.toLocaleString("pt-BR")} {categories.length === 1 ? "categoria" : "categorias"}
          </span>
        </div>
      </div>

      <CategoriesTable categories={categories} />

      <ToastContainer />
    </div>
  );
}
