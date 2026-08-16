import type { CSSProperties } from "react";
import { generateColorScale, hexToRgb, rgbToHex, type ColorScale } from "./color-scale";
import type { ThemeTokens } from "./types";

const NEUTRAL_STEP_INDEX: Record<string, number> = {
  "50": 0, "100": 1, "200": 2, "300": 3, "400": 4,
  "500": 5, "600": 6, "700": 7, "800": 8, "900": 9,
};

function lerpHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(
    ca.r + (cb.r - ca.r) * t,
    ca.g + (cb.g - ca.g) * t,
    ca.b + (cb.b - ca.b) * t
  );
}

/**
 * Os tokens do admin só definem 5 dos 10 degraus de neutral (background/
 * surface/border/textPrimary/textSecondary) — os degraus "intermediários"
 * (300/600 nos dois esquemas, 50/200 no escuro, 700/800 no claro) são usados
 * por componentes existentes (tabelas, inputs, badges) mas ficavam presos ao
 * valor hardcoded de globals.css, sem reagir ao preset. Preenche-os por
 * interpolação linear em RGB entre os dois âncoras definidos mais próximos —
 * aproximação suficiente pra manter contraste/legibilidade em qualquer
 * preset, sem exigir um seletor de cor por degrau no admin de tema.
 */
function fillNeutralScale(vars: Record<string, string>, anchors: Record<string, string>) {
  const known = Object.entries(anchors)
    .map(([step, hex]) => ({ index: NEUTRAL_STEP_INDEX[step], hex }))
    .sort((a, b) => a.index - b.index);

  for (const step of Object.keys(NEUTRAL_STEP_INDEX)) {
    if (anchors[step]) {
      vars[`--color-neutral-${step}`] = anchors[step];
      continue;
    }
    const index = NEUTRAL_STEP_INDEX[step];
    const lower = [...known].reverse().find((a) => a.index < index);
    const upper = known.find((a) => a.index > index);
    if (lower && upper) {
      const t = (index - lower.index) / (upper.index - lower.index);
      vars[`--color-neutral-${step}`] = lerpHex(lower.hex, upper.hex, t);
    } else if (lower) {
      vars[`--color-neutral-${step}`] = lower.hex;
    } else if (upper) {
      vars[`--color-neutral-${step}`] = upper.hex;
    }
  }
}

const BASE_RADIUS: Record<string, number> = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
};

const SCALE_MULTIPLIER: Record<ThemeTokens["typography"]["scale"], number> = {
  compact: 0.9,
  comfortable: 1,
  spacious: 1.1,
};

function scaleVars(prefix: string, family: string, scale: ColorScale, vars: Record<string, string>) {
  (Object.keys(scale) as (keyof ColorScale)[]).forEach((step) => {
    vars[`--color-${family}-${step}`] = scale[step];
  });
  vars[`--color-${family}`] = scale["500"];
  if (prefix === "success" || prefix === "warning" || prefix === "danger" || prefix === "info") {
    vars[`--color-${family}-light`] = scale["100"];
  }
}

/**
 * Converte os tokens do admin em CSS custom properties, sobrescrevendo
 * exatamente as mesmas variáveis já declaradas em @theme (globals.css) —
 * nenhuma classe Tailwind existente muda de nome, só o valor por trás dela.
 *
 * background/surface/border/texto mapeiam para os degraus de --color-neutral-*
 * que as classes dark:/claras do app já usam de fato (ver padrão estabelecido
 * em ui/card.tsx, ui/input.tsx: bg-white dark:bg-neutral-800/900,
 * text-neutral-900 dark:text-neutral-100, border-neutral-200 dark:border-*).
 */
export function tokensToCssVars(tokens: ThemeTokens): CSSProperties {
  const vars: Record<string, string> = {};

  scaleVars("primary", "primary", generateColorScale(tokens.colors.primary), vars);
  scaleVars("secondary", "secondary", generateColorScale(tokens.colors.secondary), vars);
  scaleVars("success", "success", generateColorScale(tokens.colors.success), vars);
  scaleVars("warning", "warning", generateColorScale(tokens.colors.warning), vars);
  scaleVars("danger", "danger", generateColorScale(tokens.colors.danger), vars);
  scaleVars("info", "info", generateColorScale(tokens.colors.info), vars);

  if (tokens.colorScheme === "dark") {
    fillNeutralScale(vars, {
      "900": tokens.colors.background,
      "800": tokens.colors.surface,
      "700": tokens.colors.border,
      "400": tokens.colors.textSecondary,
      "100": tokens.colors.textPrimary,
    });
  } else {
    fillNeutralScale(vars, {
      "50": tokens.colors.background,
      "100": tokens.colors.surface,
      "200": tokens.colors.border,
      "500": tokens.colors.textSecondary,
      "900": tokens.colors.textPrimary,
    });
  }

  Object.entries(BASE_RADIUS).forEach(([step, base]) => {
    vars[`--radius-${step}`] = `${Math.round(base * tokens.radiusScale)}px`;
  });

  vars["--font-sans"] =
    tokens.typography.fontFamily === "jetbrains"
      ? "var(--font-jetbrains), ui-monospace, monospace"
      : "var(--font-inter), ui-sans-serif, system-ui, sans-serif";
  vars["--font-scale"] = String(SCALE_MULTIPLIER[tokens.typography.scale]);
  vars["--density-scale"] = String(SCALE_MULTIPLIER[tokens.density]);

  return vars as CSSProperties;
}
