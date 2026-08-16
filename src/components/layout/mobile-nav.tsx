"use client";

import { cn } from "@/lib/utils";
import {
    FileText,
    LayoutDashboard,
    Plus,
    Settings,
    Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const mobileNavItems = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "Cotações", href: "/cotacoes", icon: FileText },
  { label: "Nova", href: "/cotacoes/nova", icon: Plus, isPrimary: true },
  { label: "Fornecedores", href: "/fornecedores", icon: Users },
  { label: "Config", href: "/configuracoes", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {mobileNavItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          if (item.isPrimary) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-center h-12 w-12 -mt-4 rounded-full bg-primary-500 text-white shadow-lg hover:bg-primary-600 transition-all active:scale-95"
              >
                <item.icon className="h-6 w-6" />
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-3 text-xs transition-colors",
                isActive
                  ? "text-primary-600"
                  : "text-neutral-400"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
