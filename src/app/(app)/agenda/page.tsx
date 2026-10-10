import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarHeart, CircleCheck, Plus } from "lucide-react";
import { AppointmentCard } from "@/components/agenda/appointment-card";
import { DateNav } from "@/components/agenda/date-nav";
import { WeekStrip } from "@/components/agenda/week-strip";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfessional } from "@/lib/auth/session";
import { intervalsOverlap, occupiesSlot } from "@/lib/appointments/conflicts";
import { agendaHref, parseDateParam } from "@/lib/agenda-url";
import { listAppointmentsInRange, type AppointmentItem } from "@/lib/data/appointments";
import { addDays, startOfWeek, toZonedParts, todayInZone, zonedDateTimeToUtc } from "@/lib/timezone";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  return (
    <>
      <PageHeader title="Agenda" />
      {/* data e filtros vêm da URL, lidos no request: ficam atrás de Suspense (Cache Components) */}
      <Suspense fallback={<div className="px-5 text-sm text-taupe-soft">Carregando a agenda...</div>}>
        <AgendaContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AgendaContent({ searchParams }: { searchParams: PageProps<"/agenda">["searchParams"] }) {
  const me = await getCurrentProfessional();
  if (!me) redirect("/auth/acesso-negado");

  const params = await searchParams;
  const today = todayInZone();
  const date = parseDateParam(params.data, today);
  const highlightId = typeof params.destaque === "string" ? params.destaque : undefined;
  const justSaved = highlightId !== undefined;
  const rescheduled = params.remarcado === "1";
  const cancelled = params.cancelado === "1";

  // uma única consulta traz a semana inteira: alimenta a lista do dia e as contagens da faixa semanal
  const weekStart = startOfWeek(date, 1);
  const weekItems = await listAppointmentsInRange(
    zonedDateTimeToUtc(weekStart, "00:00"),
    zonedDateTimeToUtc(addDays(weekStart, 7), "00:00"),
  );
  // a RLS já entrega só os atendimentos da própria profissional
  const visible = weekItems;

  const counts: Record<string, number> = {};
  for (const a of visible) {
    const day = toZonedParts(a.start_at).date;
    counts[day] = (counts[day] ?? 0) + 1;
  }
  const dayItems = visible.filter((a) => toZonedParts(a.start_at).date === date);

  const overlapping = findOverlappingIds(dayItems);
  const newHref = `/agendamentos/novo?data=${date}`;

  return (
    <div className="space-y-4 px-5">
      {cancelled && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-[#e4ede5] px-4 py-3 text-sm font-medium text-[#2f5a3a]">
          <CircleCheck className="size-4" aria-hidden />
          Atendimento cancelado. O horário foi liberado.
        </p>
      )}
      {justSaved && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-[#e4ede5] px-4 py-3 text-sm font-medium text-[#2f5a3a]">
          <CircleCheck className="size-4" aria-hidden />
          {rescheduled
            ? "Atendimento remarcado. Como o horário mudou, ele voltou para Aguardando confirmação."
            : "Atendimento salvo."}
        </p>
      )}

      <DateNav date={date} today={today} />
      <WeekStrip date={date} today={today} counts={counts} />

      <p className="text-sm text-taupe-soft" aria-live="polite">
        {dayItems.length === 0
          ? "Nenhum atendimento neste dia"
          : dayItems.length === 1
            ? "1 atendimento neste dia"
            : `${dayItems.length} atendimentos neste dia`}
      </p>

      {dayItems.length === 0 ? (
        <div className="-mx-5">
          <EmptyState
            icon={CalendarHeart}
            title="Dia livre"
            description="Nenhum atendimento marcado para este dia. Que tal agendar o primeiro?"
          >
            <Link href={newHref} className={buttonVariants()}>
              <Plus aria-hidden />
              Agendar atendimento
            </Link>
          </EmptyState>
        </div>
      ) : (
        <ul className="space-y-3">
          {dayItems.map((item) => (
            <AppointmentCard
              key={item.id}
              item={item}
              afterCancelHref={agendaHref({ date, cancelled: true })}
              overlaps={overlapping.has(item.id)}
              highlighted={item.id === highlightId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** IDs de atendimentos que se sobrepõem a outro da MESMA profissional (profissionais diferentes podem coincidir). */
function findOverlappingIds(items: AppointmentItem[]): Set<string> {
  const ids = new Set<string>();
  const active = items.filter((i) => occupiesSlot(i.status));
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (
        a.professional_id === b.professional_id &&
        intervalsOverlap(new Date(a.start_at), new Date(a.end_at), new Date(b.start_at), new Date(b.end_at))
      ) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
}
