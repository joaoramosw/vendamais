import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { HomeBlocksRenderer } from "@/components/home/HomeBlocksRenderer";
import { getPublishedHomeBlocks } from "@/lib/theme/get-home-blocks";
import { waMeUrl } from "@/lib/whatsapp";
import Link from "next/link";

export default async function Home() {
  const blocks = await getPublishedHomeBlocks();

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 selection:bg-primary-100 dark:selection:bg-primary-900/50 selection:text-primary-900 dark:selection:text-primary-100 overflow-x-hidden transition-colors duration-300">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[50%] bg-primary-100/30 dark:bg-primary-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[40%] bg-info-100/20 dark:bg-info-900/10 blur-[100px] rounded-full" />
      </div>

      {/* Navigation — fora do sistema de blocos */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md border-b border-neutral-100 dark:border-neutral-800 transition-colors duration-300">
        <nav className="flex items-center justify-between px-6 lg:px-12 py-4 max-w-7xl mx-auto w-full">
          <Link href="/" className="group transition-transform hover:scale-[1.02]">
            <Logo variant="full" size="lg" priority />
          </Link>

          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm font-bold text-neutral-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors hidden sm:block"
            >
              Fazer Login
            </Link>
            <a
              href={waMeUrl("Olá! Quero criar uma conta na VendaMais.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" className="px-5 font-bold shadow-md shadow-primary-500/10 dark:shadow-primary-500/5 h-10">
                Criar Conta Grátis
              </Button>
            </a>
          </div>
        </nav>
      </header>

      <HomeBlocksRenderer blocks={blocks} />
    </div>
  );
}
