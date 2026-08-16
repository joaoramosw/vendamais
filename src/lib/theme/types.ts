export type ThemeColorScheme = "light" | "dark";
export type ThemeFontFamily = "inter" | "jetbrains";
export type ThemeScaleStep = "compact" | "comfortable" | "spacious";

export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
}

export interface ThemeTokens {
  colorScheme: ThemeColorScheme;
  colors: ThemeColors;
  radiusScale: number;
  typography: {
    fontFamily: ThemeFontFamily;
    scale: ThemeScaleStep;
  };
  density: ThemeScaleStep;
  logoUrl: string | null;
}

export type ThemePresetKey = "default" | "light";

export interface ThemeResult {
  preset: ThemePresetKey | (string & {});
  tokens: ThemeTokens;
  version: string;
}
