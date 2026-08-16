import { hexToRgb } from "./color-scale";

export { hexToRgb };

/**
 * Luminância relativa WCAG 2.x (sRGB → linear → coeficientes de luminância).
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const [rl, gl, bl] = [toLinear(r), toLinear(g), toLinear(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** Razão de contraste WCAG entre duas cores hex, de 1:1 (idênticas) a 21:1 (preto/branco). */
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWcagAA(fgHex: string, bgHex: string, opts?: { largeText?: boolean }): boolean {
  const minimum = opts?.largeText ? 3 : 4.5;
  return contrastRatio(fgHex, bgHex) >= minimum;
}

export function meetsWcagAAA(fgHex: string, bgHex: string, opts?: { largeText?: boolean }): boolean {
  const minimum = opts?.largeText ? 4.5 : 7;
  return contrastRatio(fgHex, bgHex) >= minimum;
}
