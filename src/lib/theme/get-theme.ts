'use server'

/**
 * get-theme.ts — Leitura cacheada do tema ativo (site_settings).
 *
 * Usa um client Supabase anônimo "puro" (sem cookies()) de propósito: a
 * leitura é pública (RLS `SELECT USING (true)`) e não deve depender de
 * request context, porque a função interna roda dentro de unstable_cache
 * — Next.js não permite APIs dinâmicas (cookies()/headers()) dentro de
 * funções cacheadas dessa forma.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { DEFAULT_THEME_RESULT } from "./defaults";
import { THEME_PRESETS } from "./presets";
import type { ThemePresetKey, ThemeResult, ThemeTokens } from "./types";

function getAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function mergeTokens(preset: ThemePresetKey, overrides: Partial<ThemeTokens> | null): ThemeTokens {
  const base = THEME_PRESETS[preset] ?? THEME_PRESETS.default;
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    colors: { ...base.colors, ...(overrides.colors ?? {}) },
    typography: { ...base.typography, ...(overrides.typography ?? {}) },
  };
}

const fetchSiteSettingsRow = unstable_cache(
  async (): Promise<ThemeResult> => {
    const supabase = getAnonClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("theme_preset, theme_tokens, updated_at")
      .is("organization_id", null)
      .maybeSingle();

    if (error || !data) {
      throw new Error(error?.message ?? "site_settings: nenhuma linha global encontrada");
    }

    const preset = (data.theme_preset ?? "default") as ThemePresetKey;
    const overrides = (data.theme_tokens ?? null) as Partial<ThemeTokens> | null;

    return {
      preset,
      tokens: mergeTokens(preset, overrides),
      version: data.updated_at ?? "unknown",
    };
  },
  ["site-settings-theme"],
  { tags: ["theme"] }
);

export async function getTheme(): Promise<ThemeResult> {
  try {
    return await fetchSiteSettingsRow();
  } catch {
    return DEFAULT_THEME_RESULT;
  }
}
