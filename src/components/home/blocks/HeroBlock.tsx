import { Hero } from "@/components/ui/animated-hero";
import type { HomeBlock } from "@/lib/theme/home-blocks";

export function HeroBlock({ titulo, texto }: Pick<HomeBlock, "titulo" | "texto">) {
  return <Hero titulo={titulo} texto={texto} />;
}
