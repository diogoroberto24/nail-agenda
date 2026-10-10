import { intervalsOverlap } from "@/lib/appointments/conflicts";
import { addDays, formatShortWeekday, startOfWeek, toZonedParts, zonedDateTimeToUtc } from "@/lib/timezone";

/**
 * Grade de horários da etapa "Data e horário". Não existe expediente cadastrado (decisão do produto):
 * a grade é fixa, de 30 em 30 minutos, e qualquer outro horário pode ser digitado em "Outro horário".
 * O último horário da grade COMEÇA às 19:30, para o dia terminar às 20:00.
 */
export const SLOT_STEP_MINUTES = 30;
export const DAY_START = "08:00";
export const DAY_END = "20:00";

/** Intervalo ocupado da profissional (instantes UTC, como vêm do banco). */
export type BusyInterval = { startAt: string; endAt: string };

export type SlotState =
  /** livre */
  | "available"
  /** cruza outro atendimento da mesma profissional (para a duração escolhida) */
  | "busy"
  /** já passou (vale para hoje e dias anteriores) */
  | "past";

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHHmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** "08:00".."19:30" de 30 em 30 minutos (o fim é exclusivo). */
export function generateSlotTimes(start = DAY_START, end = DAY_END, step = SLOT_STEP_MINUTES): string[] {
  const out: string[] = [];
  for (let m = toMinutes(start); m < toMinutes(end); m += step) out.push(toHHmm(m));
  return out;
}

/** O atendimento que começa em `date` + `time` e dura `durationMinutes` cruza algum intervalo ocupado? */
export function overlapsBusy(date: string, time: string, durationMinutes: number, busy: BusyInterval[]): boolean {
  const start = zonedDateTimeToUtc(date, time);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return busy.some((b) => intervalsOverlap(start, end, new Date(b.startAt), new Date(b.endAt)));
}

/** Estado de um horário da grade. "Passado" tem prioridade sobre "ocupado". */
export function slotState(date: string, time: string, durationMinutes: number, busy: BusyInterval[], now: Date): SlotState {
  if (zonedDateTimeToUtc(date, time).getTime() < now.getTime()) return "past";
  return overlapsBusy(date, time, durationMinutes, busy) ? "busy" : "available";
}

export function classifySlots(date: string, durationMinutes: number, busy: BusyInterval[], now: Date) {
  return generateSlotTimes().map((time) => ({ time, state: slotState(date, time, durationMinutes, busy, now) }));
}

/** Horário de término ("HH:mm") de um atendimento, e se cai em outro dia. */
export function endOf(date: string, time: string, durationMinutes: number): { time: string; nextDay: boolean } {
  const end = new Date(zonedDateTimeToUtc(date, time).getTime() + durationMinutes * 60_000);
  const parts = toZonedParts(end);
  return { time: parts.time, nextDay: parts.date !== date };
}

export type WeekDay = { date: string; weekday: string; dayNumber: number };

/** Os 7 dias (segunda a domingo) da semana que contém a data. */
export function weekDaysMondayFirst(date: string): WeekDay[] {
  const first = startOfWeek(date, 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(first, i);
    const label = formatShortWeekday(d);
    return { date: d, weekday: label.charAt(0).toUpperCase() + label.slice(1), dayNumber: Number(d.slice(8)) };
  });
}

const MONTHS_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** "Outubro 2026"; se a semana atravessa dois meses: "Out – Nov 2026"; dois anos: "Dez 2026 – Jan 2027". */
export function weekHeaderLabel(days: WeekDay[]): string {
  const [y1, m1] = [Number(days[0].date.slice(0, 4)), Number(days[0].date.slice(5, 7)) - 1];
  const [y2, m2] = [Number(days[6].date.slice(0, 4)), Number(days[6].date.slice(5, 7)) - 1];
  if (y1 === y2 && m1 === m2) return `${MONTHS_LONG[m1]} ${y1}`;
  if (y1 === y2) return `${MONTHS_SHORT[m1]} – ${MONTHS_SHORT[m2]} ${y1}`;
  return `${MONTHS_SHORT[m1]} ${y1} – ${MONTHS_SHORT[m2]} ${y2}`;
}
