import { z } from "zod";
import { isValidHex } from "./color-scale";
import { meetsWcagAA } from "./contrast";

export const hexColorSchema = z
  .string()
  .refine(isValidHex, "Cor inválida. Use o formato hex #RRGGBB.");

export const themePresetKeySchema = z.string().trim().min(1).max(50);

export const radiusScaleSchema = z.number().min(0.5).max(2);

const themeColorsSchema = z.object({
  primary: hexColorSchema,
  secondary: hexColorSchema,
  success: hexColorSchema,
  warning: hexColorSchema,
  danger: hexColorSchema,
  info: hexColorSchema,
  background: hexColorSchema,
  surface: hexColorSchema,
  border: hexColorSchema,
  textPrimary: hexColorSchema,
  textSecondary: hexColorSchema,
});

export const themeTokensSchema = z
  .object({
    colorScheme: z.enum(["light", "dark"]),
    colors: themeColorsSchema,
    radiusScale: radiusScaleSchema,
    typography: z.object({
      fontFamily: z.enum(["inter", "jetbrains"]),
      scale: z.enum(["compact", "comfortable", "spacious"]),
    }),
    density: z.enum(["compact", "comfortable", "spacious"]),
    logoUrl: z.string().url().nullable(),
  })
  .superRefine((tokens, ctx) => {
    if (!meetsWcagAA(tokens.colors.textPrimary, tokens.colors.background)) {
      ctx.addIssue({
        code: "custom",
        path: ["colors", "textPrimary"],
        message: "Contraste insuficiente entre texto primário e fundo (mínimo WCAG AA, 4.5:1).",
      });
    }
    if (!meetsWcagAA(tokens.colors.textPrimary, tokens.colors.surface)) {
      ctx.addIssue({
        code: "custom",
        path: ["colors", "textPrimary"],
        message: "Contraste insuficiente entre texto primário e superfície (mínimo WCAG AA, 4.5:1).",
      });
    }
  });
