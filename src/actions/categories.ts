"use server";

import { createClient } from "@/lib/supabase/server";
import type { CategoryWithCount } from "@/lib/types/database";

/* ─── Helpers ─── */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ─── GET ALL CATEGORIES ─── */
export async function getCategories(): Promise<{ categories: CategoryWithCount[]; error?: string }> {
  const supabase = await createClient();

  const { data: categories, error } = await supabase
    .from("categories")
    .select("*")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) return { categories: [], error: error.message };

  // Count products per category — zero rows downloaded (head: true)
  const countResults = await Promise.all(
    (categories ?? []).map((cat) =>
      supabase
        .from("product_categories")
        .select("*", { count: "exact", head: true })
        .eq("category_id", cat.id)
    )
  );

  const countMap: Record<string, number> = {};
  (categories ?? []).forEach((cat, i) => {
    countMap[cat.id] = countResults[i].count ?? 0;
  });

  const enriched: CategoryWithCount[] = (categories ?? []).map((cat) => ({
    ...cat,
    product_count: countMap[cat.id] || 0,
  }));

  return { categories: enriched };
}

/* ─── CREATE CATEGORY ─── */
export async function createCategory(formData: FormData) {
  const supabase = await createClient();

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const color = (formData.get("color") as string)?.trim() || "#6366f1";

  if (!name) return { error: "Nome é obrigatório." };

  const slug = slugify(name);

  // Check duplicate slug (só entre as não-deletadas)
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) return { error: "Já existe uma categoria com este nome." };

  const { data, error } = await supabase
    .from("categories")
    .insert({ name, slug, description, color })
    .select()
    .single();

  if (error) return { error: error.message };
  return { category: data };
}

/* ─── UPDATE CATEGORY ─── */
export async function updateCategory(id: string, formData: FormData) {
  const supabase = await createClient();

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const color = (formData.get("color") as string)?.trim() || "#6366f1";

  if (!name) return { error: "Nome é obrigatório." };

  const slug = slugify(name);

  // Check duplicate slug (not self, só entre as não-deletadas)
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .neq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) return { error: "Já existe outra categoria com este nome." };

  const { data, error } = await supabase
    .from("categories")
    .update({ name, slug, description, color })
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };
  return { category: data };
}

/* ─── DELETE CATEGORY (soft delete) ─── */
export async function deleteCategory(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("categories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true };
}

/* ─── ASSIGN PRODUCT CATEGORIES ─── */
export async function assignProductCategories(
  productId: string,
  categoryIds: string[]
) {
  const supabase = await createClient();

  // Delete existing associations
  await supabase
    .from("product_categories")
    .delete()
    .eq("product_id", productId);

  if (categoryIds.length === 0) return { success: true };

  // Insert new associations
  const rows = categoryIds.map((categoryId) => ({
    product_id: productId,
    category_id: categoryId,
  }));

  const { error } = await supabase.from("product_categories").insert(rows);

  if (error) return { error: error.message };
  return { success: true };
}

/* ─── GET CATEGORIES FOR A PRODUCT ─── */
export async function getProductCategoryIds(productId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("product_categories")
    .select("category_id")
    .eq("product_id", productId);

  return (data ?? []).map((row) => row.category_id);
}
