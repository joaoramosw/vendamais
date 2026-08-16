'use server'

/**
 * get-home-blocks.ts — Leitura cacheada dos blocos publicados da home.
 *
 * Mesmo padrão de get-theme.ts (client anônimo sem cookies(), cache tag
 * 'theme' compartilhada — um único revalidateTag('theme') invalida tema e
 * home juntos) e o mesmo fallback seguro em caso de falha.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { DEFAULT_HOME_BLOCKS, homeBlocksArraySchema, type HomeBlock } from "./home-blocks";

function getAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const fetchPublishedBlocks = unstable_cache(
  async (): Promise<HomeBlock[]> => {
    const supabase = getAnonClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("home_blocks_published")
      .is("organization_id", null)
      .maybeSingle();

    if (error || !data) {
      throw new Error(error?.message ?? "site_settings: nenhuma linha global encontrada");
    }

    const parsed = homeBlocksArraySchema.safeParse(data.home_blocks_published);
    if (!parsed.success || parsed.data.length === 0) {
      throw new Error("home_blocks_published vazio ou inválido");
    }

    return parsed.data;
  },
  ["site-settings-home-blocks"],
  { tags: ["theme"] }
);

export async function getPublishedHomeBlocks(): Promise<HomeBlock[]> {
  try {
    return await fetchPublishedBlocks();
  } catch {
    return DEFAULT_HOME_BLOCKS;
  }
}
