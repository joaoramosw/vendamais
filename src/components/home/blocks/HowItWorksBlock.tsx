import { Button } from "@/components/ui/button";
import type { HomeBlock } from "@/lib/theme/home-blocks";
import { waMeUrl } from "@/lib/whatsapp";
import { ArrowRight, CheckCircle2, Globe } from "lucide-react";

const STEPS = [
  { step: "01", text: "O empresário publica sua lista de compras em segundos." },
  { step: "02", text: "Sua base de fornecedores é notificada em tempo real." },
  { step: "03", text: "Você recebe orçamentos organizados e prontos para comparar." },
  { step: "04", text: "Escolha o ganhador e finalize o pedido com segurança." },
];

export function HowItWorksBlock({ titulo, texto }: Pick<HomeBlock, "titulo" | "texto">) {
  return (
    <section className="py-24 px-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 bg-neutral-900 dark:bg-neutral-50 text-white dark:text-neutral-900 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
            Workflow
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-neutral-900 dark:text-neutral-50 tracking-tight leading-tight">
            {titulo}
          </h2>
          {texto && (
            <p className="text-lg text-neutral-600 dark:text-neutral-300 font-medium">{texto}</p>
          )}
          <div className="space-y-6">
            {STEPS.map((item, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <span className="text-primary-500 font-black text-lg pt-1">{item.step}</span>
                <p className="text-lg text-neutral-600 dark:text-neutral-300 font-medium">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="pt-4">
            <a
              href={waMeUrl("Olá! Quero saber mais sobre a VendaMais.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="ghost"
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-bold flex items-center gap-2 p-0 h-auto hover:bg-transparent dark:hover:bg-transparent"
              >
                Fale com um especialista no WhatsApp
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>

        <div className="relative">
          <div className="aspect-square bg-gradient-to-br from-primary-100 to-info-50 dark:from-primary-900/40 dark:to-info-900/40 rounded-[var(--radius-3xl)] rotate-3 relative overflow-hidden shadow-2xl dark:shadow-none dark:ring-1 dark:ring-neutral-800">
            <div className="absolute inset-8 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-xl rounded-[var(--radius-2xl)] border border-white/40 dark:border-neutral-700/50 p-8 flex flex-col justify-between shadow-inner dark:shadow-none">
              <div className="space-y-4">
                <div className="h-2 w-24 bg-primary-200 dark:bg-primary-500/50 rounded-full" />
                <div className="h-2 w-48 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
                <div className="h-2 w-32 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
              </div>
              <div className="flex items-end justify-between">
                <div className="space-y-3">
                  <div className="h-10 w-10 bg-success-500 dark:bg-success-600 rounded-full flex items-center justify-center text-white">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Aprovado</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-neutral-900 dark:text-neutral-100">R$ 12.450</p>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold">Melhor Proposta</p>
                </div>
              </div>
            </div>
          </div>
          {/* Floating element */}
          <div className="absolute -bottom-6 -right-6 h-28 w-28 bg-white dark:bg-neutral-800 rounded-3xl shadow-2xl dark:shadow-xl dark:shadow-black/50 border border-neutral-100 dark:border-neutral-700 flex flex-col items-center justify-center p-4 animate-bounce-slow">
            <Globe className="h-8 w-8 text-primary-500 dark:text-primary-400 mb-2" />
            <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-400 uppercase text-center">+500 Fornecedores</p>
          </div>
        </div>
      </div>
    </section>
  );
}
