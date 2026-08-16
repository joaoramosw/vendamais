import { getProducts } from "@/actions/products";
import { ProductsTable } from "@/components/produtos/ProductsTable";
import { ToastContainer } from "@/components/ui/toast";
import { normalizePerPage } from "@/lib/pagination";
import { getCurrentUserRole } from "@/lib/roles.server";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    barcode?: string;
    dateFrom?: string;
    dateTo?: string;
    priceMin?: string;
    priceMax?: string;
    page?: string;
    perPage?: string;
  }>;
}

export default async function ProdutosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const role = await getCurrentUserRole();

  if (role === "supplier") {
    redirect("/fornecedor/dashboard");
  }

  const page = params.page ? parseInt(params.page, 10) : 1;
  // A listagem carrega o resto por scroll (ver ProductsTable) — este é só o
  // tamanho do primeiro lote, escolhido pelo usuário.
  const perPage = normalizePerPage(params.perPage);

  const { products, total, categories } = await getProducts({
    search: params.search,
    category: params.category,
    barcode: params.barcode,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    priceMin: params.priceMin,
    priceMax: params.priceMax,
    page,
    perPage,
  });

  return (
    // O cabeçalho (título, botão Configurações e o total) vive dentro da
    // ProductsTable: o botão liga/desliga funcionalidades da tela e depende do
    // estado do cliente, então precisa ficar junto do resto da listagem.
    <div className="space-y-6 animate-fade-in">
      <ProductsTable
        products={products}
        total={total}
        categories={categories}
        userRole={role}
        perPage={perPage}
        perPageFromUrl={!!params.perPage}
        filters={{
          search: params.search,
          category: params.category,
          barcode: params.barcode,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          priceMin: params.priceMin,
          priceMax: params.priceMax,
        }}
      />

      <ToastContainer />
    </div>
  );
}
