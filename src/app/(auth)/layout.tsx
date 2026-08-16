import { Logo } from "@/components/brand/logo"
import { CheckCircle2, ShoppingBasket, Tags } from "lucide-react"

const FEATURES = [
  {
    icon: Tags,
    title: "Cotações em minutos",
    description: "Monte o pedido a partir do catálogo e envie para vários fornecedores de uma vez.",
  },
  {
    icon: ShoppingBasket,
    title: "Compare propostas lado a lado",
    description: "Veja preço, prazo e observações de cada fornecedor e aceite a melhor oferta.",
  },
  {
    icon: CheckCircle2,
    title: "Decisões mais rápidas",
    description: "Receba propostas organizadas e feche negociação sem trocar dezenas de mensagens.",
  },
]

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white">
      {/* Coluna de branding — oculta no mobile */}
      <div className="hidden lg:flex flex-col justify-between p-12 border-r border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-neutral-900/60">
        <div>
          <Logo variant="full" size="xl" priority />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-3">
            Cotação inteligente para redes de mercados
          </p>
        </div>

        <ul className="space-y-6 max-w-md">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex gap-4">
              <div className="shrink-0 flex items-center justify-center h-11 w-11 rounded-[var(--radius-md)] bg-primary-500/10 text-primary-600 dark:text-primary-400">
                <feature.icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">
                  {feature.title}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {feature.description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          © {new Date().getFullYear()} VendaMais
        </p>
      </div>

      {/* Coluna do formulário */}
      <div className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md lg:max-w-lg">
          {/* Logo/heading também visível no mobile */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <Logo variant="full" size="lg" priority />
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-2">
              Cotação inteligente para redes de mercados
            </p>
          </div>
          <div className="animate-fade-in">{children}</div>
        </div>
      </div>
    </div>
  )
}
