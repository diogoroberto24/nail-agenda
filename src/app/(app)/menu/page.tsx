import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  LogOut,
  Settings,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { logout } from "@/app/login/actions";

export const metadata: Metadata = { title: "Menu" };

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/servicos", label: "Serviços", icon: Sparkles },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

export default function MenuPage() {
  return (
    <>
      <PageHeader title="Menu" />
      <ul className="mx-5 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-14 items-center gap-3 px-4 text-cocoa active:bg-muted">
              <Icon className="size-5 text-rose-deep" strokeWidth={1.7} aria-hidden />
              <span className="flex-1 font-medium">{label}</span>
              <ChevronRight className="size-4 text-taupe" aria-hidden />
            </Link>
          </li>
        ))}
        <li>
          <form action={logout}>
            <button
              type="submit"
              className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-cocoa active:bg-muted"
            >
              <LogOut className="size-5 text-rose-deep" strokeWidth={1.7} aria-hidden />
              <span className="flex-1 font-medium">Sair</span>
            </button>
          </form>
        </li>
      </ul>
    </>
  );
}
