import { THEME_PRESETS } from "./presets";
import type { ThemeResult, ThemeTokens } from "./types";

export const DEFAULT_THEME_TOKENS: ThemeTokens = THEME_PRESETS.default;

export const DEFAULT_THEME_RESULT: ThemeResult = {
  preset: "default",
  tokens: DEFAULT_THEME_TOKENS,
  version: "fallback",
};
