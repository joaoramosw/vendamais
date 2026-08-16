import { Button } from "@/components/ui/button";
import type { HomeBlock } from "@/lib/theme/home-blocks";
import { waMeUrl } from "@/lib/whatsapp";
import Link from "next/link";

export function CtaBlock({ titulo, texto }: Pick<HomeBlock, "titulo" | "texto">) {
  return (
    <section className="py-24 px-6 max-w-5xl mx-auto">
      <div className="bg-neutral-900 rounded-[var(--radius-4xl)] p-12 lg:p-20 text-center relative overflow-hidden dark:bg-neutral-900 dark:ring-1 dark:ring-neutral-800">
        <div className="absolute top-0 right-0 p-20 opacity-10 blur-2xl bg-primary-500 rounded-full" />
        <div className="relative z-10 space-y-8">
          <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tight">{titulo}</h2>
          <p className="text-neutral-400 text-lg lg:text-xl max-w-xl mx-auto font-medium leading-relaxed">{texto}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={waMeUrl("Olá! Quero criar uma conta gratuita na VendaMais.")} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto px-12 h-16 shadow-xl shadow-primary-500/10 dark:shadow-none">
                Criar conta gratuita
              </Button>
            </a>
            <Link href="/login" className="w-full sm:w-auto">
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto px-12 h-16 text-neutral-900 dark:text-white border-2 border-white/10 dark:border-neutral-700 hover:bg-white/5 dark:hover:bg-neutral-800 font-bold bg-white/5 dark:bg-neutral-800/50"
              >
                Acessar minha conta
              </Button>
            </Link>
          </div>
          <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Sem cartão de crédito — Configuração em 2 minutos</p>
        </div>
      </div>
    </section>
  );
}
