import { Card, CardBody } from "@/components/ui/card";
import type { HomeBlock } from "@/lib/theme/home-blocks";
import { FileText, Send, Shield } from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "Cotações Multinível",
    description:
      "Crie solicitações complexas em segundos, com suporte a múltiplos itens, unidades e observações técnicas detalhadas.",
    color: "text-primary-600 dark:text-primary-400",
    bg: "bg-primary-50 dark:bg-primary-950/30",
  },
  {
    icon: Send,
    title: "Propostas Blindadas",
    description:
      "Fornecedores enviam orçamentos em uma interface padronizada, eliminando erros de interpretação e agilizando a leitura.",
    color: "text-info-600 dark:text-info-400",
    bg: "bg-info-50 dark:bg-info-950/30",
  },
  {
    icon: Shield,
    title: "Comparador Inteligente",
    description:
      "Nossa tecnologia destaca as melhores ofertas automaticamente por item ou por lote total, garantindo a sua economia.",
    color: "text-success-600 dark:text-success-400",
    bg: "bg-success-light dark:bg-success-950/30",
  },
];

export function FeatureBlock({ titulo, texto }: Pick<HomeBlock, "titulo" | "texto">) {
  return (
    <section className="py-24 bg-neutral-50/50 dark:bg-neutral-900/20 border-y border-neutral-100 dark:border-neutral-800/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20 space-y-4">
          <h2 className="text-3xl lg:text-5xl font-black text-neutral-900 dark:text-neutral-50 tracking-tight">{titulo}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-lg max-w-xl mx-auto font-medium">{texto}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {FEATURES.map((feature, i) => (
            <Card
              key={i}
              className="group border-none shadow-sm dark:shadow-none bg-white dark:bg-neutral-900 ring-1 ring-neutral-100 dark:ring-neutral-800 hover:shadow-xl hover:dark:ring-neutral-700 hover:-translate-y-2 transition-all duration-300"
            >
              <CardBody className="p-10 space-y-6">
                <div
                  className={`h-14 w-14 rounded-2xl ${feature.bg} ${feature.color} flex items-center justify-center group-hover:scale-110 transition-transform`}
                >
                  <feature.icon className="h-7 w-7" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{feature.title}</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">
                    {feature.description}
                  </p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
