import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * pdfkit e exceljs (rota /api/cotacoes/[id]/export) não sobrevivem ao
   * bundling do build — pdfkit lê os arquivos de fonte .afm do próprio
   * node_modules em runtime. Externalizados, o file tracing da Vercel leva
   * os pacotes inteiros junto da função.
   */
  serverExternalPackages: ["pdfkit", "exceljs"],
  images: {
    /**
     * remotePatterns é o padrão atual recomendado (Next.js 13+).
     * A antiga propriedade `domains` foi depreciada.
     *
     * Regras:
     *  - protocol: restringe http/https (sempre use https em produção)
     *  - hostname: aceita wildcard com ** (qualquer subdomínio)
     *  - port: deixe vazio para aceitar porta padrão (80/443)
     *  - pathname: ** aceita qualquer caminho
     */
    remotePatterns: [
      // ─── Supabase Storage ─────────────────────────────────────────────────
      // Cobre: <project>.supabase.co, <project>.supabase.in, etc.
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.in",
        pathname: "/storage/v1/object/public/**",
      },

      // ─── CDNs de catálogos de produtos (e-commerce / fornecedores) ────────
      // Destro / Fbit (catálogo de produtos)
      {
        protocol: "https",
        hostname: "destro.fbitsstatic.net",
      },
      {
        protocol: "https",
        hostname: "**.fbitsstatic.net",
      },
      // Outros CDNs comuns de fornecedores brasileiros
      {
        protocol: "https",
        hostname: "**.shopify.com",
      },
      {
        protocol: "https",
        hostname: "**.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "**.imgix.net",
      },
      // Images genéricas via Google, Wikipedia, etc. (opcional — remova se não precisar)
      {
        protocol: "https",
        hostname: "**.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "**.gstatic.com",
      },

      // ─── Amazon ─────────────────────────────────────────────────────────────
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
      },
      {
        protocol: "https",
        hostname: "**.media-amazon.com",
      },
      {
        protocol: "https",
        hostname: "images-na.ssl-images-amazon.com",
      },

      // ─── Mercado Livre / MLStatic ───────────────────────────────────────────
      {
        protocol: "https",
        hostname: "**.mlstatic.com",
      },
      {
        protocol: "https",
        hostname: "**.mercadolivre.com.br",
      },

      // ─── Imgur ──────────────────────────────────────────────────────────────
      {
        protocol: "https",
        hostname: "i.imgur.com",
      },
      {
        protocol: "https",
        hostname: "**.imgur.com",
      },

      // ─── Unsplash / Pexels ──────────────────────────────────────────────────
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.pexels.com",
      },

      // ─── WordPress / WP.com ─────────────────────────────────────────────────
      {
        protocol: "https",
        hostname: "**.wp.com",
      },
      {
        protocol: "https",
        hostname: "**.wordpress.com",
      },

      // ─── AliExpress / AliCDN ────────────────────────────────────────────────
      {
        protocol: "https",
        hostname: "**.alicdn.com",
      },
      {
        protocol: "https",
        hostname: "**.aliexpress.com",
      },

      // ─── Misc CDNs ─────────────────────────────────────────────────────────
      {
        protocol: "https",
        hostname: "**.cdninstagram.com",
      },
      {
        protocol: "https",
        hostname: "**.fbcdn.net",
      },
      {
        protocol: "https",
        hostname: "**.wikimedia.org",
      },

      // ─── Google User Content / Images ────────────────────────────────────────
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },

      // ─── Pinterest ───────────────────────────────────────────────────────────
      {
        protocol: "https",
        hostname: "**.pinimg.com",
      },

      // ─── Placeholders ────────────────────────────────────────────────────────
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "**.placeholder.com",
      },

      // ─── Wix ─────────────────────────────────────────────────────────────────
      {
        protocol: "https",
        hostname: "**.wixstatic.com",
      },

      // ─── VTEX (e-commerces brasileiros) ──────────────────────────────────────
      {
        protocol: "https",
        hostname: "**.vteximg.com.br",
      },
      {
        protocol: "https",
        hostname: "**.vtexassets.com",
      },

      // ─── Magazine Luiza / Magalu ─────────────────────────────────────────────
      {
        protocol: "https",
        hostname: "**.magazineluiza.com.br",
      },
      {
        protocol: "https",
        hostname: "**.magalu.com",
      },

      // ─── Americanas / B2W ────────────────────────────────────────────────────
      {
        protocol: "https",
        hostname: "**.americanas.com.br",
      },
      {
        protocol: "https",
        hostname: "**.b2w.io",
      },

      // ─── Casas Bahia / Via Varejo ────────────────────────────────────────────
      {
        protocol: "https",
        hostname: "**.casasbahia.com.br",
      },

      // ─── Kabum ───────────────────────────────────────────────────────────────
      {
        protocol: "https",
        hostname: "**.kabum.com.br",
      },
    ],

    /**
     * Formatos modernos: Next.js Image já serve avif/webp automaticamente
     * via negociação de conteúdo (Accept header).
     * Ordene do mais comprimido para o mais compatível.
     */
    formats: ["image/avif", "image/webp"],

    /**
     * deviceSizes e imageSizes controlam os srcsets gerados.
     * Valores ajustados para uso em cards de produto (máx ~600px).
     */
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    /**
     * minimumCacheTTL: tempo mínimo (segundos) que o Next Image Optimizer
     * mantém a imagem em cache. 7 dias é um bom padrão para imagens de produto.
     */
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 dias
  },
};

export default nextConfig;

