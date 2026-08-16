import { getCategories, getProductCategoryIds } from "@/actions/categories";
import { getMargemConfig } from "@/actions/margem";
import { getHistoricoProduto } from "@/actions/product-history";
import { getProduct } from "@/actions/products";
import { ProductForm } from "@/components/produtos/ProductForm";
import { ProdutoHistoricoSection } from "@/components/produtos/historico/ProdutoHistoricoSection";
import { ToastContainer } from "@/components/ui/toast";
import { getCurrentUserRole } from "@/lib/roles.server";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarProdutoPage({ params }: PageProps) {
  const { id } = await params;
  const role = await getCurrentUserRole();

  if (role === "supplier") {
    redirect("/fornecedor/dashboard");
  }

  let product;
  try {
    product = await getProduct(id);
  } catch {
    notFound();
  }

  const { categories } = await getCategories();
  const initialCategoryIds = await getProductCategoryIds(id);

  // Histórico e margem carregam no servidor para a seção já montar com dado —
  // o refetch por período depois acontece no cliente.
  const [{ config: margemConfig }, historicoInicial] = await Promise.all([
    getMargemConfig(),
    getHistoricoProduto(id, "30d"),
  ]);

  return (
    <>
      <ProductForm
        product={product}
        userRole={role}
        categories={categories}
        initialCategoryIds={initialCategoryIds}
      />
      <ProdutoHistoricoSection
        productId={id}
        margemConfig={margemConfig}
        historicoInicial={historicoInicial}
      />
      <ToastContainer />
    </>
  );
}
