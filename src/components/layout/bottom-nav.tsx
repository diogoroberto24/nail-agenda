"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Menu, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** prefixos de rota que também marcam este item como ativo */
  matches: string[];
};

const ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: Home, matches: [] },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, matches: ["/agenda", "/agendamentos"] },
  { href: "/clientes", label: "Clientes", icon: Users, matches: ["/clientes"] },
  {
    href: "/menu",
    label: "Menu",
    icon: Menu,
    matches: ["/menu", "/servicos", "/disponibilidade", "/configuracoes", "/perfil"],
  },
];

function isActive(item: NavItem, pathname: string) {
  if (item.href === "/") return pathname === "/";
  return item.matches.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

/** Barra de navegação. Recebe a rota atual para poder ser desenhada também como fallback do Suspense (sem item ativo). */
export function BottomNavView({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur pb-safe"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-4">
        {ITEMS.map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[4.25rem] flex-col items-center justify-center gap-1 text-[0.72rem] font-medium transition-colors",
                  active ? "text-rose-deep" : "text-taupe-soft",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active && "bg-nude",
                  )}
                >
                  <Icon className="size-[1.35rem]" strokeWidth={active ? 2.2 : 1.7} aria-hidden />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function BottomNav() {
  return <BottomNavView pathname={usePathname()} />;
}
