import { SonnerToaster } from "@/components/ui/sonner-toaster";
import { themeToHtmlProps } from "@/components/theme/theme-html-props";
import { getTheme } from "@/lib/theme/get-theme";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Venda Mais — Cotação Inteligente",
  description:
    "Plataforma de cotação inteligente para mercados e fornecedores. Crie cotações, receba propostas e compare preços com agilidade.",
  keywords: ["cotação", "fornecedores", "compras", "B2B", "SaaS"],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getTheme();
  const { className, style } = themeToHtmlProps(theme);

  return (
    <html lang="pt-BR" className={className} style={style}>
      <body className={`${inter.variable} ${jetbrains.variable} antialiased bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 transition-colors`}>
        {children}
        <SonnerToaster />
      </body>
    </html>
  );
}
