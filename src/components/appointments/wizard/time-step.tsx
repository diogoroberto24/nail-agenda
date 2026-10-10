"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { listBusyWeekAction } from "@/app/(app)/agendamentos/actions";
import { useDraft, useStepGuard } from "@/components/appointments/wizard/draft-context";
import { StepFooter } from "@/components/appointments/wizard/step-footer";
import { Input } from "@/components/ui/input";
import { classifySlots, endOf, overlapsBusy, slotState, weekDaysMondayFirst, weekHeaderLabel, type BusyInterval } from "@/lib/appointments/slots";
import { nextHref } from "@/lib/appointments/wizard";
import { addDays, formatLongDateCapitalized, isValidTimeString, startOfWeek } from "@/lib/timezone";
import { useFormIds } from "@/lib/use-form-ids";
import { cn } from "@/lib/utils";

/**
 * Etapa 3: data (semana de segunda a domingo) e horário (grade de 30 em 30 minutos, mais "Outro horário").
 * Horários que já passaram ficam desligados. Horários que cruzam outro atendimento da própria profissional
 * continuam escolhíveis, só marcados como ocupados: o aviso (nunca bloqueio) é confirmado ao agendar.
 * `today` e `nowIso` vêm do servidor.
 */
export function TimeStep({ today, nowIso }: { today: string; nowIso: string }) {
  const id = useFormIds();
  const router = useRouter();
  const { draft, update } = useDraft();
  const ready = useStepGuard("horario");
  const retornoAoResumo = useSearchParams().get("retorno") === "detalhes";
  const now = new Date(nowIso);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(draft.date || today, 1));
  const [busyData, setBusyData] = useState<{ week: string; intervals: BusyInterval[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const dayStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    listBusyWeekAction(weekStart)
      .then((intervals) => {
        if (cancelled) return;
        setFailed(false);
        setBusyData({ week: weekStart, intervals });
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setBusyData({ week: weekStart, intervals: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  // mantém o dia escolhido à vista na faixa de dias (que rola em telas muito estreitas)
  useEffect(() => {
    dayStripRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [weekStart, ready]);

  if (!ready) return <div className="px-5 text-sm text-taupe-soft">Carregando...</div>;

  const days = weekDaysMondayFirst(weekStart);
  const loadingBusy = busyData?.week !== weekStart;
  const busy = busyData?.week === weekStart ? busyData.intervals : [];
  const duration = Math.max(1, Number(draft.durationMinutes) || draft.service?.durationMinutes || 30);
  const slots = draft.date ? classifySlots(draft.date, duration, busy, now) : [];
  const canGoBack = weekStart > startOfWeek(today, 1);

  const timeValid = isValidTimeString(draft.time);
  const selectedState = draft.date && timeValid ? slotState(draft.date, draft.time, duration, busy, now) : null;
  const selectedBusy = draft.date && timeValid && !loadingBusy && overlapsBusy(draft.date, draft.time, duration, busy);
  const canContinue = Boolean(draft.date) && timeValid && selectedState !== "past";
  const isOnGrid = slots.some((s) => s.time === draft.time);
  const end = canContinue ? endOf(draft.date, draft.time, duration) : null;

  function chooseDay(date: string) {
    if (date === draft.date) return;
    update({ date, time: "" });
  }

  return (
    <div className="space-y-5 px-5">
      <section aria-labelledby={id("semana")} className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            disabled={!canGoBack}
            aria-label="Semana anterior"
            className="inline-flex size-11 items-center justify-center rounded-xl text-cocoa disabled:opacity-30"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <h3 id={id("semana")} className="text-center text-base font-semibold text-cocoa">
            {weekHeaderLabel(days)}
          </h3>
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Próxima semana"
            className="inline-flex size-11 items-center justify-center rounded-xl text-cocoa"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>

        <div ref={dayStripRef} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="group" aria-label="Dias da semana">
          {days.map((d) => {
            const past = d.date < today;
            const selected = d.date === draft.date;
            return (
              <button
                key={d.date}
                type="button"
                disabled={past}
                aria-pressed={selected}
                aria-label={`${formatLongDateCapitalized(d.date)}${d.date === today ? " (hoje)" : ""}`}
                onClick={() => chooseDay(d.date)}
                className={cn(
                  "flex min-h-16 min-w-11 flex-1 flex-col items-center justify-center rounded-xl border text-sm transition-colors",
                  selected ? "border-cocoa bg-cocoa text-offwhite" : "border-input bg-card text-cocoa",
                  d.date === today && !selected && "border-rose-deep",
                  past && "opacity-35",
                )}
              >
                <span className="text-xs">{d.weekday}</span>
                <span className="text-base font-semibold tabular-nums">{d.dayNumber}</span>
              </button>
            );
          })}
        </div>
      </section>

      {!draft.date ? (
        <p className="flex items-center gap-2 rounded-xl bg-nude/50 px-4 py-3 text-sm text-taupe-soft">
          <CalendarDays className="size-4 shrink-0" aria-hidden />
          Escolha um dia para ver os horários.
        </p>
      ) : (
        <section aria-labelledby={id("horarios")} className="space-y-3">
          <h3 id={id("horarios")} className="text-base font-semibold text-cocoa">
            Horários · {formatLongDateCapitalized(draft.date)}
          </h3>

          {failed && (
            <p role="alert" className="text-sm text-rose-deep">
              Não foi possível conferir os horários ocupados. Você ainda pode escolher um horário.
            </p>
          )}

          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Horários">
            {slots.map(({ time, state }) => {
              const selected = draft.time === time;
              return (
                <button
                  key={time}
                  type="button"
                  disabled={state === "past"}
                  aria-pressed={selected}
                  aria-label={state === "busy" ? `${time}, ocupado` : state === "past" ? `${time}, já passou` : time}
                  onClick={() => update({ time })}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center rounded-xl border text-base font-medium tabular-nums transition-colors",
                    selected ? "border-cocoa bg-cocoa text-offwhite" : "border-input bg-card text-cocoa",
                    state === "busy" && !selected && "border-dashed border-rose-deep/60 bg-nude/40 text-taupe-soft",
                    state === "past" && "opacity-35",
                  )}
                >
                  {time}
                  {state === "busy" && <span className="text-[0.65rem] font-normal leading-none">ocupado</span>}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <label htmlFor={id("outro")} className="flex items-center gap-2 text-sm font-medium text-cocoa">
              <Clock className="size-4" aria-hidden />
              Outro horário
            </label>
            <Input id={id("outro")} type="time" value={isOnGrid ? "" : draft.time} onChange={(e) => update({ time: e.target.value })} />
          </div>

          {selectedState === "past" && (
            <p role="alert" className="text-sm text-rose-deep">
              Esse horário já passou. Escolha outro.
            </p>
          )}

          {selectedBusy && selectedState !== "past" && (
            <p role="status" className="flex items-start gap-2 rounded-xl bg-nude/60 px-4 py-3 text-sm text-cocoa">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-deep" aria-hidden />
              Você já tem um atendimento nesse horário. Dá para continuar, mas vamos pedir sua confirmação ao agendar.
            </p>
          )}

          {end && (
            <p className="text-sm text-taupe-soft">
              Termina às {end.time}
              {end.nextDay ? " (no dia seguinte)" : ""} · {duration} min
            </p>
          )}
        </section>
      )}

      <StepFooter
        canContinue={canContinue}
        hint={!draft.date ? "Escolha o dia e o horário para continuar." : "Escolha um horário para continuar."}
        onContinue={() => router.push(nextHref("horario", retornoAoResumo))}
      />
    </div>
  );
}
