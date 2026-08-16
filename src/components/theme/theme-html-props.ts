import type { CSSProperties } from "react";
import { tokensToCssVars } from "@/lib/theme/css-vars";
import type { ThemeResult } from "@/lib/theme/types";

/**
 * Deriva os atributos do <html> a partir do tema resolvido no servidor.
 *
 * Não é um componente — um componente filho não consegue escrever atributos
 * no elemento <html> do RootLayout. `style` inline vence `:root` por
 * especificidade, então isso aplica o tema sem useEffect e sem flash/mismatch
 * de hidratação (o servidor já decide a classe `dark` e as variáveis antes
 * de qualquer HTML sair pro cliente).
 */
export function themeToHtmlProps(theme: ThemeResult): {
  className: string;
  style: CSSProperties;
} {
  return {
    className: theme.tokens.colorScheme === "dark" ? "dark" : "",
    style: tokensToCssVars(theme.tokens),
  };
}
