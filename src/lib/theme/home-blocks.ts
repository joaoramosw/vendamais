import { z } from "zod";

export type HomeBlockType =
  | "hero"
  | "social_proof"
  | "feature"
  | "how_it_works"
  | "cta"
  | "footer";

export interface HomeBlock {
  id: string;
  tipo: HomeBlockType;
  titulo: string;
  texto: string;
  visivel: boolean;
  ordem: number;
}

export const HOME_BLOCK_TYPES: HomeBlockType[] = [
  "hero",
  "social_proof",
  "feature",
  "how_it_works",
  "cta",
  "footer",
];

export const HOME_BLOCK_LABELS: Record<HomeBlockType, string> = {
  hero: "Hero",
  social_proof: "Prova social (logos)",
  feature: "O que fazemos",
  how_it_works: "Como funciona",
  cta: "Chamada para ação",
  footer: "Rodapé",
};

/**
 * Conteúdo atual de src/app/page.tsx, usado como seed inicial (a migration
 * 014 já inicializa home_blocks_draft/published com '[]'::jsonb) e como
 * fallback se a leitura do banco falhar — reproduz a home de hoje 1:1.
 */
export const DEFAULT_HOME_BLOCKS: HomeBlock[] = [
  {
    id: "hero",
    tipo: "hero",
    titulo: "Conecte seu Mercado aos",
    texto:
      "Abandone os orçamentos manuais. Publique suas demandas e receba propostas inteligentes, detalhadas e competitivas em uma única plataforma profissional.",
    visivel: true,
    ordem: 0,
  },
  {
    id: "social_proof",
    tipo: "social_proof",
    titulo: "Utilizado por redes de destaque",
    texto: "",
    visivel: true,
    ordem: 1,
  },
  {
    id: "feature",
    tipo: "feature",
    titulo: "O que fazemos por você?",
    texto:
      "Uma plataforma completa pensada para agilizar a rotina de compras e vendas do setor varejista.",
    visivel: true,
    ordem: 2,
  },
  {
    id: "how_it_works",
    tipo: "how_it_works",
    titulo: "Do pedido à escolha final em minutos",
    texto: "",
    visivel: true,
    ordem: 3,
  },
  {
    id: "cta",
    tipo: "cta",
    titulo: "Escale seu negócio agora",
    texto: "Junte-se a centenas de empresários que já economizaram tempo e dinheiro com a Venda Mais.",
    visivel: true,
    ordem: 4,
  },
  {
    id: "footer",
    tipo: "footer",
    titulo: "",
    texto: "",
    visivel: true,
    ordem: 5,
  },
];

export const homeBlockSchema = z.object({
  id: z.string().min(1),
  tipo: z.enum(HOME_BLOCK_TYPES as [HomeBlockType, ...HomeBlockType[]]),
  titulo: z.string().max(200),
  texto: z.string().max(1000),
  visivel: z.boolean(),
  ordem: z.number().int().min(0),
});

export const homeBlocksArraySchema = z.array(homeBlockSchema).max(HOME_BLOCK_TYPES.length);
