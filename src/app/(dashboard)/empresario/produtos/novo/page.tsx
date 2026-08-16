import { getCategories } from "@/actions/categories";
import { ProductForm } from "@/components/produtos/ProductForm";
import { ToastContainer } from "@/components/ui/toast";
import { getCurrentUserRole } from "@/lib/roles.server";
import { redirect } from "next/navigation";

export default async function NovoProdutoPage() {
  const role = await getCurrentUserRole();

  if (role === "supplier") {
    redirect("/fornecedor/dashboard");
  }

  const { categories } = await getCategories();

  return (
    <>
      <ProductForm userRole={role} categories={categories} />
      <ToastContainer />
    </>
  );
}
