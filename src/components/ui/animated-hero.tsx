"use client";

import { Button } from "@/components/ui/button";
import { waMeUrl } from "@/lib/whatsapp";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface HeroProps {
  titulo?: string;
  texto?: string;
}

const DEFAULT_TITULO = "Conecte seu Mercado aos";
const DEFAULT_TEXTO =
  "Abandone os orçamentos manuais. Publique suas demandas e receba propostas inteligentes, detalhadas e competitivas em uma única plataforma profissional.";

function Hero({ titulo = DEFAULT_TITULO, texto = DEFAULT_TEXTO }: HeroProps) {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => [
      "Melhores Fornecedores",
      "Maiores Distribuidores",
      "Preços Competitivos",
      "Parceiros Ideais",
      "Grandes Atacadistas"
    ],
    []
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 3000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <section className="relative pt-40 pb-20 lg:pt-56 lg:pb-32 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-8 animate-fade-in-up border border-primary-100 dark:border-primary-900/30">
          <Sparkles className="h-4 w-4" />
          A Evolução das Cotações B2B
        </div>
        
        <h1 className="text-5xl lg:text-7xl font-black text-neutral-900 dark:text-neutral-50 tracking-tight leading-[1.1] mb-8 max-w-5xl animate-fade-in-up [animation-delay:100ms] flex flex-col items-center">
          <span>{titulo}</span>
          <span className="relative flex w-full justify-center overflow-hidden text-center h-[1.3em]">
            {titles.map((title, index) => (
              <motion.span
                key={index}
                className="absolute font-black bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-400 dark:from-primary-400 dark:to-primary-300 bottom-0 top-0 pt-2"
                initial={{ opacity: 0, y: "-100%" }}
                transition={{ type: "spring", stiffness: 50 }}
                animate={
                  titleNumber === index
                    ? { y: 0, opacity: 1 }
                    : { y: titleNumber > index ? "-150%" : "150%", opacity: 0 }
                }
              >
                {title}
              </motion.span>
            ))}
          </span>
        </h1>
        
        <p className="text-lg lg:text-xl text-neutral-500 dark:text-neutral-400 max-w-2xl mb-12 leading-relaxed animate-fade-in-up [animation-delay:200ms]">
          {texto}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full animate-fade-in-up [animation-delay:300ms]">
          <a href={waMeUrl("Olá! Quero começar a usar a VendaMais.")} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto px-10 h-14 text-lg shadow-xl shadow-primary-500/20 dark:shadow-primary-500/10 group">
              Começar agora
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </a>
          <Link href="/fornecedores" className="w-full sm:w-auto">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto px-10 h-14 text-lg border-2 border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 dark:text-neutral-200 font-bold bg-white dark:bg-neutral-900">
              Para fornecedores
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export { Hero };
