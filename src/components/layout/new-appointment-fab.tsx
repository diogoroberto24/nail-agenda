"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

/** Rotas em que o botão de novo agendamento deve aparecer. */
const VISIBLE_ON = ["/", "/agenda"];

export function NewAppointmentFab() {
  const pathname = usePathname();
  if (!VISIBLE_ON.includes(pathname)) return null;

  return (
    <Link
      href="/agendamentos/novo"
      aria-label="Novo agendamento"
      className="fixed right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-rose pl-4 pr-5 font-medium text-cocoa shadow-fab transition-transform active:scale-95"
      style={{ bottom: "calc(var(--spacing-nav) + env(safe-area-inset-bottom) + 1rem)" }}
    >
      <Plus className="size-5" strokeWidth={2.4} aria-hidden />
      Agendar
    </Link>
  );
}
