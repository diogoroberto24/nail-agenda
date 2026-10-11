import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { CalendarClock, Pencil } from "lucide-react";
import { EndRecurrenceButton } from "@/components/recurrence/end-recurrence-button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import type { AppointmentStatus } from "@/lib/appointments/status";
import { getRecurrence, listUpcomingOccurrences } from "@/lib/data/recurrences";
import { formatDuration } from "@/lib/datetime";
import { formatBRL } from "@/lib/money";
import { describeRule } from "@/lib/recurrence/rules";
import { ruleOf } from "@/lib/recurrence/service";
import { formatDateBR, formatShortWeekday, formatTime } from "@/lib/timezone";

export const metadata: Metadata = { title: "Recorrência" };

export default function RecurrencePage({ params }: PageProps<"/recorrencias/[id]">) {
  return (
    <Suspense fallback={<div className="p-5 text-sm text-taupe-soft">Carregando...</div>}>
      <Recurrence params={params} />
    </Suspense>
  );
}

async function Recurrence({ params }: { params: PageProps<"/recorrencias/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const rec = await getRecurrence(id);
  if (!rec || !rec.clients) notFound();
  const ended = rec.ended_at !== null;
  const upcoming = ended ? [] : await listUpcomingOccurrences(rec.id, new Date());

  return (
    <>
      <PageHeader title="Recorrência" backHref={`/clientes/${rec.client_id}`} backLabel={rec.clients.full_name} />
      <div className="space-y-5 px-5">
        {ended && (
          <p role="status" className="rounded-xl bg-[#efedeb] px-4 py-3 text-sm text-taupe-soft">
            Recorrência encerrada. Os atendimentos já realizados continuam no histórico.
          </p>
        )}

        <section aria-label="Regra" className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-cocoa">
            <CalendarClock className="size-5 text-rose-deep" aria-hidden />
            {describeRule(ruleOf(rec))}, às {rec.start_time.slice(0, 5)}
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.95rem]">
            <dt className="text-taupe-soft">Cliente</dt>
            <dd className="text-right font-medium text-cocoa">
              <Link href={`/clientes/${rec.client_id}`} className="inline-flex min-h-11 items-center underline">
                {rec.clients.full_name}
              </Link>
            </dd>
            <dt className="text-taupe-soft">Serviço</dt>
            <dd className="text-right font-medium text-cocoa">{rec.services?.name ?? "—"}</dd>
            <dt className="text-taupe-soft">Duração</dt>
            <dd className="text-right font-medium text-cocoa">{formatDuration(rec.duration_minutes)}</dd>
            <dt className="text-taupe-soft">Preço</dt>
            <dd className="text-right font-medium text-cocoa">{formatBRL(rec.price)}</dd>
            <dt className="text-taupe-soft">Primeiro atendimento</dt>
            <dd className="text-right font-medium text-cocoa">{formatDateBR(rec.start_date)}</dd>
            <dt className="text-taupe-soft">Termina</dt>
            <dd className="text-right font-medium text-cocoa">{rec.end_date ? formatDateBR(rec.end_date) : "Sem data final"}</dd>
          </dl>
          {rec.notes && <p className="whitespace-pre-line border-t border-border pt-3 text-[0.95rem] text-taupe-soft">{rec.notes}</p>}
        </section>

        {!ended && (
          <div className="flex flex-col gap-3">
            <Link href={`/recorrencias/${rec.id}/alterar`} className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}>
              <Pencil aria-hidden />
              Alterar a partir de uma data
            </Link>
            <EndRecurrenceButton recurrenceId={rec.id} clientId={rec.client_id} />
          </div>
        )}

        {!ended && (
          <section aria-labelledby="proximos" className="space-y-3">
            <h2 id="proximos" className="text-2xl font-semibold text-cocoa">
              Próximos atendimentos
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-taupe-soft">Nenhum atendimento futuro nesta recorrência.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((o) => {
                  const weekday = formatShortWeekday(o.occurrence_date);
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/agendamentos/${o.id}`}
                        className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2 active:bg-muted"
                      >
                        <span className="font-medium tabular-nums text-cocoa">
                          {weekday.charAt(0).toUpperCase() + weekday.slice(1)}, {formatDateBR(o.occurrence_date)} · {formatTime(o.start_at)}
                        </span>
                        <StatusBadge status={o.status as AppointmentStatus} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  );
}
