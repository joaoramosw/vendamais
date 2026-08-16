"use server";

import { requireAdminWithClient } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";

export interface Segmento {
  id: string;
  nome: string;
  slug: string;
  cor: string | null;
  created_at: string;
}

export interface SegmentoWithCount extends Segmento {
  fornecedor_count: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ─── GET ALL SEGMENTOS ─── */
export async function getSegmentos(): Promise<{ segmentos: SegmentoWithCount[]; error?: string }> {
  const supabase = await createClient();

  const { data: segmentos, error } = await supabase
    .from("segmentos")
    .select("*")
    .is("deleted_at", null)
    .order("nome", { ascending: true });

  if (error) return { segmentos: [], error: error.message };

  // A coluna se chama "Fornecedores": conta só quem tem role `supplier`, senão
  // um admin que por acidente tenha `segmento_id` entraria na conta e o número
  // divergiria da lista do modal (getFornecedoresPorSegmento).
  const { data: supplierRole } = await supabase
    .from("roles")
    .select("id")
    .eq("key", "supplier")
    .maybeSingle();

  const countResults = await Promise.all(
    (segmentos ?? []).map((s) => {
      const query = supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("segmento_id", s.id)
        .is("deleted_at", null);

      return supplierRole ? query.eq("role_id", supplierRole.id) : query;
    })
  );

  const countMap: Record<string, number> = {};
  (segmentos ?? []).forEach((s, i) => {
    countMap[s.id] = countResults[i].count ?? 0;
  });

  const enriched: SegmentoWithCount[] = (segmentos ?? []).map((s) => ({
    ...s,
    fornecedor_count: countMap[s.id] || 0,
  }));

  return { segmentos: enriched };
}

export interface FornecedorDoSegmento {
  id: string;
  nome: string;
  email: string;
  whatsapp: string | null;
  organization_name: string | null;
  created_at: string;
}

/**
 * Fornecedores classificados num segmento — usado pelo modal que abre ao
 * clicar no contador da tela de Segmentos (espelha `getProductsByCategory`
 * da tela de Categorias).
 *
 * Lê com o client admin: `users` é RLS-locked (confirmado ao vivo — a anon key
 * devolve 0 linhas), então a leitura pelo client logado é sujeita à policy e
 * pode voltar vazia sem erro. A autorização real é `requireAdminWithClient`.
 *
 * Filtra por `role = supplier` de propósito: "segmento" é classificação de
 * fornecedor, e um admin que por acidente tenha `segmento_id` não deve
 * aparecer numa lista chamada "Fornecedores".
 */
export async function getFornecedoresPorSegmento(
  segmentoId: string,
  limit = 60,
): Promise<{ fornecedores: FornecedorDoSegmento[]; total: number; error?: string }> {
  const { adminClient } = await requireAdminWithClient();

  const { data: supplierRole, error: roleError } = await adminClient
    .from("roles")
    .select("id")
    .eq("key", "supplier")
    .maybeSingle();

  if (roleError) return { fornecedores: [], total: 0, error: roleError.message };
  if (!supplierRole) return { fornecedores: [], total: 0, error: 'Role "supplier" não encontrada.' };

  const { data, count, error } = await adminClient
    .from("users")
    .select("id, nome, email, whatsapp, organization_name, created_at", { count: "exact" })
    .eq("segmento_id", segmentoId)
    .eq("role_id", supplierRole.id)
    .is("deleted_at", null)
    .order("nome", { ascending: true })
    .limit(limit);

  if (error) return { fornecedores: [], total: 0, error: error.message };

  return { fornecedores: (data ?? []) as FornecedorDoSegmento[], total: count ?? 0 };
}

/* ─── CREATE SEGMENTO ─── */
export async function createSegmento(formData: FormData) {
  const supabase = await createClient();

  const nome = (formData.get("nome") as string)?.trim();
  const cor = (formData.get("cor") as string)?.trim() || "#6366f1";

  if (!nome) return { error: "Nome é obrigatório." };

  const slug = slugify(nome);

  const { data: existing } = await supabase
    .from("segmentos")
    .select("id")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) return { error: "Já existe um segmento com este nome." };

  const { data, error } = await supabase
    .from("segmentos")
    .insert({ nome, slug, cor })
    .select()
    .single();

  if (error) return { error: error.message };
  return { segmento: data };
}

/* ─── UPDATE SEGMENTO ─── */
export async function updateSegmento(id: string, formData: FormData) {
  const supabase = await createClient();

  const nome = (formData.get("nome") as string)?.trim();
  const cor = (formData.get("cor") as string)?.trim() || "#6366f1";

  if (!nome) return { error: "Nome é obrigatório." };

  const slug = slugify(nome);

  const { data: existing } = await supabase
    .from("segmentos")
    .select("id")
    .eq("slug", slug)
    .neq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) return { error: "Já existe outro segmento com este nome." };

  const { data, error } = await supabase
    .from("segmentos")
    .update({ nome, slug, cor })
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };
  return { segmento: data };
}

/* ─── DELETE SEGMENTO (soft delete) ─── */
export async function deleteSegmento(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("segmentos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true };
}
