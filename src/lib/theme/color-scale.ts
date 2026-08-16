export type ColorScaleStep =
  | "50"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900"
  | "950";

export type ColorScale = Record<ColorScaleStep, string>;

const STEPS: ColorScaleStep[] = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
];

const LIGHT_ANCHOR_L = 97;
const DARK_ANCHOR_L = 18;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Escalas literais das paletas Tailwind usadas como default/preset "light"
 * (indigo/teal/emerald/amber/red/blue) — reproduzidas exatamente, byte a
 * byte, para que o preset padrão (sem nenhuma customização do admin) não
 * mude a aparência atual do app. generateColorScale() é uma aproximação por
 * HSL (matiz/saturação preservados, luminosidade interpolada) — não existe
 * fórmula genérica que reproduza os degraus artesanais do Tailwind a partir
 * de uma única cor; ela só entra em ação quando o admin escolhe uma cor que
 * não é uma dessas seis (ou seja, uma customização de verdade).
 */
const KNOWN_COLOR_SCALES: Record<string, ColorScale> = {
  "#6366F1": {
    "50": "#EEF2FF", "100": "#E0E7FF", "200": "#C7D2FE", "300": "#A5B4FC", "400": "#818CF8",
    "500": "#6366F1", "600": "#4F46E5", "700": "#4338CA", "800": "#3730A3", "900": "#312E81", "950": "#1E1B4B",
  },
  "#14B8A6": {
    "50": "#F0FDFA", "100": "#CCFBF1", "200": "#99F6E4", "300": "#5EEAD4", "400": "#2DD4BF",
    "500": "#14B8A6", "600": "#0D9488", "700": "#0F766E", "800": "#115E59", "900": "#134E4A", "950": "#042F2E",
  },
  "#10B981": {
    "50": "#ECFDF5", "100": "#D1FAE5", "200": "#A7F3D0", "300": "#6EE7B7", "400": "#34D399",
    "500": "#10B981", "600": "#059669", "700": "#047857", "800": "#065F46", "900": "#064E3B", "950": "#022C22",
  },
  "#F59E0B": {
    "50": "#FFFBEB", "100": "#FEF3C7", "200": "#FDE68A", "300": "#FCD34D", "400": "#FBBF24",
    "500": "#F59E0B", "600": "#D97706", "700": "#B45309", "800": "#92400E", "900": "#78350F", "950": "#451A03",
  },
  "#EF4444": {
    "50": "#FEF2F2", "100": "#FEE2E2", "200": "#FECACA", "300": "#FCA5A5", "400": "#F87171",
    "500": "#EF4444", "600": "#DC2626", "700": "#B91C1C", "800": "#991B1B", "900": "#7F1D1D", "950": "#450A0A",
  },
  "#3B82F6": {
    "50": "#EFF6FF", "100": "#DBEAFE", "200": "#BFDBFE", "300": "#93C5FD", "400": "#60A5FA",
    "500": "#3B82F6", "600": "#2563EB", "700": "#1D4ED8", "800": "#1E40AF", "900": "#1E3A8A", "950": "#172554",
  },
};

export function isValidHex(value: string): boolean {
  return HEX_RE.test(value);
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (!isValidHex(hex)) {
    throw new Error(`Cor hex inválida: "${hex}". Use o formato #RRGGBB.`);
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case rN:
      h = ((gN - bN) / d + (gN < bN ? 6 : 0)) / 6;
      break;
    case gN:
      h = ((bN - rN) / d + 2) / 6;
      break;
    default:
      h = ((rN - gN) / d + 4) / 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: Hsl): { r: number; g: number; b: number } {
  const hN = h / 360;
  const sN = s / 100;
  const lN = l / 100;

  if (sN === 0) {
    const v = lN * 255;
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = lN < 0.5 ? lN * (1 + sN) : lN + sN - lN * sN;
  const p = 2 * lN - q;

  return {
    r: hue2rgb(p, q, hN + 1 / 3) * 255,
    g: hue2rgb(p, q, hN) * 255,
    b: hue2rgb(p, q, hN - 1 / 3) * 255,
  };
}

export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

export function hslToHex(hsl: Hsl): string {
  const { r, g, b } = hslToRgb(hsl);
  return rgbToHex(r, g, b);
}

/**
 * Gera uma escala de 11 tons (50–950) a partir de um hex base, preservando
 * matiz/saturação e mantendo a cor base exatamente no degrau 500 — os demais
 * degraus interpolam linearmente a luminosidade entre âncoras claro/escuro,
 * igual ao formato das paletas do Tailwind (usado pra derivar bg-primary-100,
 * text-primary-700 etc. de uma única cor escolhida pelo admin).
 */
export function generateColorScale(baseHex: string): ColorScale {
  const known = KNOWN_COLOR_SCALES[baseHex.toUpperCase()];
  if (known) return known;

  const base = hexToHsl(baseHex);
  const baseIndex = STEPS.indexOf("500");

  const scale = {} as ColorScale;

  STEPS.forEach((step, index) => {
    if (step === "500") {
      scale[step] = baseHex.toUpperCase();
      return;
    }

    let l: number;
    if (index < baseIndex) {
      const t = index / baseIndex;
      l = LIGHT_ANCHOR_L + (base.l - LIGHT_ANCHOR_L) * t;
    } else {
      const t = (index - baseIndex) / (STEPS.length - 1 - baseIndex);
      l = base.l + (DARK_ANCHOR_L - base.l) * t;
    }

    scale[step] = hslToHex({ h: base.h, s: base.s, l });
  });

  return scale;
}
