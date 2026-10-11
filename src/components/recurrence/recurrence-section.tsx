import Link from "next/link";
import { ChevronRight, Repeat } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { describeRule } from "@/lib/recurrence/rules";
import { ruleOf } from "@/lib/recurrence/service";
import type { RecurrenceItem } from "@/lib/data/recurrences";

/** Seção "Recorrência" da ficha da cliente: as recorrências ativas da profissional logada e o atalho para criar outra. */
export function RecurrenceSection({ clientId, items }: { clientId: string; items: RecurrenceItem[] }) {
  return (
    <section aria-labelledby="recorrencia" className="space-y-3">
      <h2 id="recorrencia" className="flex items-center gap-2 text-2xl font-semibold text-cocoa">
        <Repeat className="size-5 text-rose-deep" aria-hidden />
        Recorrência
      </h2>
      {items.length === 0 ? (
        <p className="text-[0.95rem] text-taupe-soft">
          Esta cliente vem sempre no mesmo dia e horário? Crie uma recorrência e os atendimentos dos próximos 6 meses já ficam reservados.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {items.map((r) => (
            <li key={r.id}>
              <Link href={`/recorrencias/${r.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 active:bg-muted">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-cocoa">
                    {describeRule(ruleOf(r))}, às {r.start_time.slice(0, 5)}
                  </span>
                  <span className="block truncate text-sm text-taupe-soft">{r.services?.name ?? "Serviço"}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-taupe-soft" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/clientes/${clientId}/recorrencia/nova`} className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}>
        <Repeat aria-hidden />
        Nova recorrência
      </Link>
    </section>
  );
}
