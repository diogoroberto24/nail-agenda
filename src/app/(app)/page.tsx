import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, CalendarHeart, Plus } from "lucide-react";
import { AppointmentCard } from "@/components/agenda/appointment-card";
import { BirthdaysToday } from "@/components/birthdays-today";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfessional } from "@/lib/auth/session";
import { agendaHref } from "@/lib/agenda-url";
import { intervalsOverlap, occupiesSlot } from "@/lib/appointments/conflicts";
import {
  countPendingConfirmations,
  listAppointmentsInRange,
  listUpcomingAppointments,
  type AppointmentItem,
} from "@/lib/data/appointments";
import { listBirthdaysToday } from "@/lib/data/clients";
import { greetingForHour } from "@/lib/greeting";
import { addDays, formatLongDateCapitalized, toZonedParts, zonedDateTimeToUtc } from "@/lib/timezone";
import { firstName } from "@/lib/whatsapp-message";

export default function HomePage() {
  return (
    <Suspense fallback={<PageHeader title="Início" description="Carregando sua rotina..." />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const me = await getCurrentProfessional();
  if (!me) redirect("/auth/acesso-negado");

  const now = new Date();
  const { date: today, time } = toZonedParts(now);
  const greeting = greetingForHour(Number(time.slice(0, 2)));

  const dayStart = zonedDateTimeToUtc(today, "00:00");
  // a RLS já entrega só os atendimentos da própria profissional
  const [todayItems, upcoming, pending, birthdays] = await Promise.all([
    listAppointmentsInRange(dayStart, zonedDateTimeToUtc(addDays(today, 1), "00:00")),
    listUpcomingAppointments(now, undefined, 6),
    countPendingConfirmations(dayStart),
    listBirthdaysToday(today),
  ]);

  const countBy = (status: AppointmentItem["status"]) => todayItems.filter((a) => a.status === status).length;
  const overlapping = findOverlappingIds(upcoming);

  return (
    <>
      <PageHeader
        title={`${greeting}, ${firstName(me.displayName)}`}
        description={formatLongDateCapitalized(today)}
      />

      <div className="space-y-5 px-5">
        <section aria-label="Resumo de hoje" className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="text-3xl font-semibold tabular-nums text-cocoa">{todayItems.length}</p>
            <p className="text-sm text-taupe-soft">{todayItems.length === 1 ? "atendimento hoje" : "atendimentos hoje"}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="text-3xl font-semibold tabular-nums text-cocoa">{pending}</p>
            <p className="text-sm text-taupe-soft">{pending === 1 ? "confirmação pendente" : "confirmações pendentes"}</p>
          </div>
          {todayItems.length > 0 && (
            <p className="col-span-2 text-sm text-taupe-soft">
              Hoje: {countBy("completed")} concluído(s) · {countBy("confirmed")} confirmado(s) · {countBy("awaiting_confirmation")} aguardando
              confirmação
              {countBy("no_show") > 0 ? ` · ${countBy("no_show")} não compareceu` : ""}
            </p>
          )}
        </section>

        <BirthdaysToday people={birthdays} today={today} professionalName={me.displayName} />

        <section aria-labelledby="proximos" className="space-y-3">
          <h2 id="proximos" className="flex items-center gap-2 text-2xl font-semibold text-cocoa">
            <CalendarDays className="size-5 text-rose-deep" aria-hidden />
            Próximos atendimentos
          </h2>

          {upcoming.length === 0 ? (
            <div className="-mx-5">
              <EmptyState
                icon={CalendarHeart}
                title="Nenhum atendimento por vir"
                description="Quando houver atendimentos marcados, eles aparecem aqui."
              >
                <Link href="/agendamentos/novo" className={buttonVariants()}>
                  <Plus aria-hidden />
                  Marcar o primeiro atendimento
                </Link>
              </EmptyState>
            </div>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((item) => {
                const itemDate = toZonedParts(item.start_at).date;
                return (
                  <AppointmentCard
                    key={item.id}
                    item={item}
                    overlaps={overlapping.has(item.id)}
                    highlighted={false}
                    afterCancelHref={agendaHref({ date: itemDate, cancelled: true })}
                    dateLabel={dateLabelFor(itemDate, today)}
                  />
                );
              })}
            </ul>
          )}
        </section>

        <Link href={agendaHref({ date: today })} className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}>
          <CalendarDays aria-hidden />
          Abrir agenda de hoje
        </Link>
      </div>
    </>
  );
}

function dateLabelFor(date: string, today: string): string {
  const [, month, day] = date.split("-");
  if (date === today) return `Hoje, ${day}/${month}`;
  if (date === addDays(today, 1)) return `Amanhã, ${day}/${month}`;
  return formatLongDateCapitalized(date);
}

/** IDs de atendimentos que se sobrepõem a outro da MESMA profissional. */
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
