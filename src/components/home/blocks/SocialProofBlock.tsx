import type { HomeBlock } from "@/lib/theme/home-blocks";

export function SocialProofBlock({ titulo }: Pick<HomeBlock, "titulo" | "texto">) {
  return (
    <section className="pb-20 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="pt-10 border-t border-neutral-100 dark:border-neutral-800/50 w-full animate-fade-in [animation-delay:500ms]">
          <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-8">
            {titulo}
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 sm:gap-32">
            <img
              src="/images/logo novo varejo.png"
              alt="Logo Novo Varejo"
              className="h-24 sm:h-32 w-auto object-contain rounded-2xl dark:brightness-200 hover:scale-105 transition-transform duration-300"
            />
            <img
              src="/images/logo sol nascente.png"
              alt="Logo Sol Nascente"
              className="h-24 sm:h-32 w-auto object-contain rounded-2xl dark:brightness-200 hover:scale-105 transition-transform duration-300"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
