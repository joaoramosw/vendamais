import type { ThemePresetKey, ThemeTokens } from "./types";

/**
 * "default" reproduz exatamente os valores atuais de globals.css (dark fixo)
 * — é o fallback de segurança e a base do preset inicial da instalação.
 * "light" reusa as mesmas cores de marca (primary/secondary/success/...) só
 * invertendo fundo/superfície/borda/texto para claro.
 */
export const THEME_PRESETS: Record<ThemePresetKey, ThemeTokens> = {
  default: {
    colorScheme: "dark",
    colors: {
      primary: "#6366F1",
      secondary: "#14B8A6",
      success: "#10B981",
      warning: "#F59E0B",
      danger: "#EF4444",
      info: "#3B82F6",
      background: "#111827",
      surface: "#1F2937",
      border: "#374151",
      textPrimary: "#F3F4F6",
      textSecondary: "#9CA3AF",
    },
    radiusScale: 1,
    typography: { fontFamily: "inter", scale: "comfortable" },
    density: "comfortable",
    logoUrl: null,
  },
  light: {
    colorScheme: "light",
    colors: {
      primary: "#6366F1",
      secondary: "#14B8A6",
      success: "#10B981",
      warning: "#F59E0B",
      danger: "#EF4444",
      info: "#3B82F6",
      background: "#F9FAFB",
      surface: "#FFFFFF",
      border: "#E5E7EB",
      textPrimary: "#111827",
      textSecondary: "#6B7280",
    },
    radiusScale: 1,
    typography: { fontFamily: "inter", scale: "comfortable" },
    density: "comfortable",
    logoUrl: null,
  },
};

export const PRESET_LABELS: Record<ThemePresetKey, string> = {
  default: "Padrão (escuro)",
  light: "Claro",
};
