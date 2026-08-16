import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Marca VendaMais — ponto único de uso da logo.
 *
 * Duas peças, cada uma pro seu tipo de espaço:
 *
 * - **`mark`** — só o símbolo (ícone branco sobre o índigo da marca,
 *   quadrado), opcionalmente com o nome escrito ao lado. Compacto, funciona
 *   sobre qualquer fundo.
 * - **`icon`** — o app icon, o mesmo desenho do favicon, sem texto nunca.
 *   Arte própria (500×500, traço mais definido que o símbolo de 256px), pra
 *   quando só cabe o quadradinho: a sidebar recolhida (72px). Separado de
 *   `mark` de propósito — trocar a arte de um não mexe no outro.
 * - **`full`** — o lockup (símbolo + "Venda+" por extenso). Espaço largo:
 *   cabeçalhos, telas de auth. O texto é sólido, então existe uma versão por
 *   esquema de cor — troca sozinha com o tema (via CSS `dark:`, sem flash,
 *   já que a classe `.dark` é escrita no `<html>` pelo servidor). Uma
 *   superfície de fundo escuro **fixo** (não segue o tema do site) força a
 *   versão certa com `scheme="dark"`.
 *
 * O logo vertical fica em `public/logos/` como fonte do design, sem tela que
 * o referencie.
 */

const SIMBOLO_SRC = "/logos/vendamais-simbolo.png";
/** Cópia de `favicon vendamais.png` com nome sem espaço — espaço em `src` de
 * `next/image` vira `%20` e é fonte fácil de 404 silencioso. O original segue
 * intocado em `public/logos/`. */
const ICONE_SRC = "/logos/vendamais-icone.png";
const LOCKUP_ESCURO_SRC = "/logos/vendamais-logo-escuro.png"; // texto escuro, tema claro
const LOCKUP_BRANCO_SRC = "/logos/vendamais-logo-branco.png"; // texto branco, tema escuro

/** Proporção real dos arquivos (idêntica nos dois lockups). */
const LOCKUP_RATIO = 640 / 174;

export const BRAND_NAME = "Venda Mais";

export type LogoSize = "sm" | "md" | "lg" | "xl";

const LADO_SIMBOLO: Record<LogoSize, number> = { sm: 22, md: 28, lg: 36, xl: 48 };
const ALTURA_LOCKUP: Record<LogoSize, number> = { sm: 18, md: 24, lg: 32, xl: 44 };

const CLASSE_NOME: Record<LogoSize, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-3xl",
};

interface LogoProps {
  /** `mark` = símbolo (default). `icon` = app icon, sem texto. `full` =
   * lockup por extenso. */
  variant?: "mark" | "icon" | "full";
  size?: LogoSize;
  className?: string;
  /** `mark`: escreve "Venda Mais" ao lado do símbolo. Ignorado em `full` — o
   * nome já está desenhado dentro da própria imagem do lockup. */
  showText?: boolean;
  textClassName?: string;
  /**
   * Só para `variant="full"`. Superfície de fundo escuro **fixo**, que não
   * segue o tema global do site (ex.: `/proposta/[id]`), força a versão
   * branca — sem isso o lockup de texto escuro ficaria ilegível se o tema do
   * site estiver "claro". Omitido = acompanha o tema (`dark:`).
   */
  scheme?: "light" | "dark";
  /** Logo acima da dobra (cabeçalho, sidebar) — evita o lazy-load piscando. */
  priority?: boolean;
}

function Mark({
  size,
  showText,
  textClassName,
  priority,
  className,
}: {
  size: LogoSize;
  showText: boolean;
  textClassName?: string;
  priority?: boolean;
  className?: string;
}) {
  const lado = LADO_SIMBOLO[size];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src={SIMBOLO_SRC}
        alt={showText ? "" : BRAND_NAME}
        aria-hidden={showText || undefined}
        width={lado}
        height={lado}
        priority={priority}
        className="shrink-0 rounded-[22%] object-contain"
        style={{ width: lado, height: lado }}
      />
      {showText && (
        <span
          className={cn(
            "font-black tracking-tighter text-neutral-900 dark:text-white whitespace-nowrap",
            CLASSE_NOME[size],
            textClassName,
          )}
        >
          {BRAND_NAME}
        </span>
      )}
    </span>
  );
}

/** App icon puro — quadrado, sem texto, sem variação por tema (a arte já traz
 * o próprio fundo índigo). */
function Icone({
  size,
  priority,
  className,
}: {
  size: LogoSize;
  priority?: boolean;
  className?: string;
}) {
  const lado = LADO_SIMBOLO[size];
  return (
    <Image
      src={ICONE_SRC}
      alt={BRAND_NAME}
      width={lado}
      height={lado}
      priority={priority}
      className={cn("shrink-0 rounded-[22%] object-contain", className)}
      style={{ width: lado, height: lado }}
    />
  );
}

function LockupImg({
  src,
  size,
  priority,
  className,
  hiddenClassName,
}: {
  src: string;
  size: LogoSize;
  priority?: boolean;
  className?: string;
  hiddenClassName?: string;
}) {
  const altura = ALTURA_LOCKUP[size];
  return (
    <Image
      src={src}
      alt={BRAND_NAME}
      width={Math.round(altura * LOCKUP_RATIO)}
      height={altura}
      priority={priority}
      className={cn("h-auto w-auto object-contain", hiddenClassName, className)}
      style={{ height: altura }}
    />
  );
}

function Full({
  size,
  scheme,
  priority,
  className,
}: {
  size: LogoSize;
  scheme?: "light" | "dark";
  priority?: boolean;
  className?: string;
}) {
  if (scheme === "dark") {
    return (
      <LockupImg src={LOCKUP_BRANCO_SRC} size={size} priority={priority} className={className} />
    );
  }
  if (scheme === "light") {
    return (
      <LockupImg src={LOCKUP_ESCURO_SRC} size={size} priority={priority} className={className} />
    );
  }

  // Sem `scheme`: acompanha o tema — as duas imagens ficam no DOM e o CSS
  // decide qual aparece, sem JS e sem flash (a classe `.dark` já vem do
  // servidor via themeToHtmlProps).
  return (
    <span className={cn("inline-flex items-center", className)}>
      <LockupImg src={LOCKUP_ESCURO_SRC} size={size} priority={priority} hiddenClassName="dark:hidden" />
      <LockupImg
        src={LOCKUP_BRANCO_SRC}
        size={size}
        priority={priority}
        hiddenClassName="hidden dark:block"
      />
    </span>
  );
}

export function Logo({
  variant = "mark",
  size = "md",
  className,
  showText = true,
  textClassName,
  scheme,
  priority,
}: LogoProps) {
  if (variant === "full") {
    return <Full size={size} scheme={scheme} priority={priority} className={className} />;
  }

  if (variant === "icon") {
    return <Icone size={size} priority={priority} className={className} />;
  }

  return (
    <Mark
      size={size}
      showText={showText}
      textClassName={textClassName}
      priority={priority}
      className={className}
    />
  );
}
