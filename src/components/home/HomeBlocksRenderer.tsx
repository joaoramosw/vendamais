import type { ComponentType } from "react";
import { CtaBlock } from "./blocks/CtaBlock";
import { FeatureBlock } from "./blocks/FeatureBlock";
import { FooterBlock } from "./blocks/FooterBlock";
import { HeroBlock } from "./blocks/HeroBlock";
import { HowItWorksBlock } from "./blocks/HowItWorksBlock";
import { SocialProofBlock } from "./blocks/SocialProofBlock";
import type { HomeBlock, HomeBlockType } from "@/lib/theme/home-blocks";

type BlockProps = Pick<HomeBlock, "titulo" | "texto">;

const BLOCK_COMPONENTS: Record<HomeBlockType, ComponentType<BlockProps>> = {
  hero: HeroBlock,
  social_proof: SocialProofBlock,
  feature: FeatureBlock,
  how_it_works: HowItWorksBlock,
  cta: CtaBlock,
  footer: FooterBlock,
};

export function HomeBlocksRenderer({ blocks }: { blocks: HomeBlock[] }) {
  const visible = blocks.filter((b) => b.visivel).sort((a, b) => a.ordem - b.ordem);

  return (
    <>
      {visible.map((block) => {
        const Component = BLOCK_COMPONENTS[block.tipo];
        if (!Component) return null;
        return <Component key={block.id} titulo={block.titulo} texto={block.texto} />;
      })}
    </>
  );
}
