import { Logo } from "@/components/brand/logo";
import Link from "next/link";

export function FooterBlock() {
  return (
    <footer className="py-12 border-t border-neutral-100 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
        <Logo variant="full" size="sm" />

        <div className="flex items-center gap-8 text-sm font-bold text-neutral-400 dark:text-neutral-500">
          <Link href="#" className="hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors">Termos</Link>
          <Link href="#" className="hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors">Privacidade</Link>
          <Link href="#" className="hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors">Suporte</Link>
        </div>

        <p className="text-xs font-bold text-neutral-300 dark:text-neutral-600">© {new Date().getFullYear()} Venda Mais S.A.</p>
      </div>
    </footer>
  );
}
