import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { waMeUrl } from "@/lib/whatsapp";
import { CheckCircle2, Search, Shield, Star } from "lucide-react";
import Link from "next/link";

export default function FornecedoresLandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation (simplified) */}
      <header className="border-b border-neutral-100 py-6">
        <nav className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo variant="full" scheme="light" size="lg" priority />
          </Link>
          <a
            href={waMeUrl("Olá! Quero cadastrar minha empresa como fornecedor na VendaMais.")}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" className="font-bold">Começar agora</Button>
          </a>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-20 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-600 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
               Seja um parceiro
            </div>
            <h1 className="text-5xl lg:text-7xl font-black text-neutral-900 tracking-tight leading-tight">
              Aumente suas <span className="text-primary-500">Vendas B2B</span> com Inteligência
            </h1>
            <p className="text-xl text-neutral-500 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
              Tenha acesso direto a cotações de redes de mercados e empresários qualificados. Venda mais, com menos esforço comercial.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a
                href={waMeUrl("Olá! Quero cadastrar minha empresa como fornecedor na VendaMais.")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" className="h-14 px-10 text-lg shadow-xl shadow-primary-500/20 w-full sm:w-auto">
                  Cadastrar minha Empresa
                </Button>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 relative">
             <div className="absolute inset-0 bg-primary-50/50 rounded-full blur-[100px] -z-10" />
             <div className="space-y-4 pt-12">
                <Card className="shadow-lg border-none hover:translate-x-2 transition-transform">
                   <CardBody className="p-6 space-y-3">
                      <div className="h-10 w-10 bg-info-50 text-info-600 rounded-lg flex items-center justify-center">
                         <Search className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold">Acesso Total</h3>
                      <p className="text-xs text-neutral-500">Visualize centenas de cotações abertas diariamente.</p>
                   </CardBody>
                </Card>
                <Card className="shadow-lg border-none hover:translate-x-2 transition-transform">
                   <CardBody className="p-6 space-y-3">
                      <div className="h-10 w-10 bg-success-50 text-success-600 rounded-lg flex items-center justify-center">
                         <Star className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold">Reconhecimento</h3>
                      <p className="text-xs text-neutral-500">Construa sua reputação com avaliações reais.</p>
                   </CardBody>
                </Card>
             </div>
             <div className="space-y-4">
                <Card className="shadow-lg border-none hover:-translate-x-2 transition-transform">
                   <CardBody className="p-6 space-y-3">
                      <div className="h-10 w-10 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center">
                         <Shield className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold">Pagamento Seguro</h3>
                      <p className="text-xs text-neutral-500">Transações protegidas e contratos inteligentes.</p>
                   </CardBody>
                </Card>
                <Card className="shadow-lg border-none bg-neutral-900 text-white hover:-translate-x-2 transition-transform">
                   <CardBody className="p-6 space-y-3">
                      <h3 className="text-3xl font-black">24h</h3>
                      <p className="text-xs text-neutral-400">Tempo médio para receber a primeira proposta.</p>
                   </CardBody>
                </Card>
             </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="mt-32 pt-20 border-t border-neutral-100">
           <div className="text-center space-y-4 mb-20">
              <h2 className="text-4xl font-black text-neutral-900 tracking-tight">Por que ser um fornecedor Venda Mais?</h2>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {[
                { title: "Dashboard Unificado", desc: "Gerencie todas as suas ofertas enviadas em um só lugar, sem planilhas ou e-mails perdidos." },
                { title: "Live Tracking", desc: "Saiba exatamente quando o empresário visualizou sua proposta e qual sua posição no ranking." },
                { title: "Escalabilidade", desc: "Atenda múltiplos clientes simultaneamente com ferramentas que automatizam o preenchimento." }
              ].map((item, i) => (
                <div key={i} className="space-y-4">
                   <div className="flex items-center gap-2 text-primary-500">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-bold text-neutral-900">{item.title}</span>
                   </div>
                   <p className="text-neutral-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
           </div>
        </div>
      </main>

      <footer className="bg-neutral-50 py-12 mt-20 border-t border-neutral-100">
         <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-6">
            <p className="text-neutral-500 font-bold">Pronto para vender mais?</p>
            <a
              href={waMeUrl("Olá! Quero cadastrar minha empresa como fornecedor na VendaMais.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="px-12 h-14 font-black">Quero me Cadastrar</Button>
            </a>
         </div>
      </footer>
    </div>
  );
}
