/**
 * Regras de datas da recorrência de atendimentos. Tudo em "data local do salão" (YYYY-MM-DD) e horário local
 * (HH:mm); só na hora de gravar é que vira instante UTC. Sem dependência de banco: testável por inteiro.
 */
import { overlapsBusy, type BusyInterval } from "@/lib/appointments/slots";
import { addDays, isValidDateString, weekdayOf, zonedDateTimeToUtc } from "@/lib/timezone";

export type Frequency = "weekly" | "monthly" | "every_days";

/** Até quantos meses à frente os atendimentos são gerados. */
export const HORIZON_MONTHS = 6;
/** Trava de segurança: nenhuma geração passa disso (a cada 1 dia por 6 meses dá ~184). */
export const MAX_OCCURRENCES = 400;

export type RecurrenceRule = {
  frequency: Frequency;
  /** só para "a cada X dias" (1 a 365) */
  intervalDays: number | null;
  /** data do primeiro atendimento */
  startDate: string;
  /** vazio = sem fim (segue sendo reposta até o horizonte) */
  endDate: string | null;
  /** datas que não devem gerar atendimento */
  skippedDates: readonly string[];
};

const pad = (n: number) => String(n).padStart(2, "0");

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Soma meses mantendo o dia; se o mês não tem esse dia, usa o último ("31/01" + 1 mês → "28/02"). */
export function addMonthsClamped(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${pad(month)}-${pad(Math.min(d, daysInMonth(year, month)))}`;
}

/** Último dia em que se geram atendimentos: hoje + 6 meses. */
export function horizonEnd(today: string): string {
  return addMonthsClamped(today, HORIZON_MONTHS);
}

/** A n-ésima ocorrência (n = 0 é a data de início). A mensal parte SEMPRE do dia de início, sem "derivar". */
export function nthOccurrence(rule: Pick<RecurrenceRule, "frequency" | "intervalDays" | "startDate">, n: number): string {
  switch (rule.frequency) {
    case "weekly":
      return addDays(rule.startDate, 7 * n);
    case "every_days":
      return addDays(rule.startDate, (rule.intervalDays ?? 1) * n);
    case "monthly":
      return addMonthsClamped(rule.startDate, n);
  }
}

/**
 * Datas de atendimento da regra em [from, until], em ordem, sem as puladas e respeitando o fim da regra.
 * `from` permite repor só o que falta (a partir de hoje); a contagem sempre parte da data de início.
 */
export function occurrenceDates(rule: RecurrenceRule, range: { from: string; until: string }): string[] {
  if (rule.frequency === "every_days" && (!rule.intervalDays || rule.intervalDays < 1)) return [];
  const last = rule.endDate && rule.endDate < range.until ? rule.endDate : range.until;
  const skipped = new Set(rule.skippedDates);
  const out: string[] = [];
  for (let n = 0; n < MAX_OCCURRENCES * 4; n++) {
    const date = nthOccurrence(rule, n);
    if (date > last) break;
    if (date >= range.from && !skipped.has(date)) {
      out.push(date);
      if (out.length >= MAX_OCCURRENCES) break;
    }
  }
  return out;
}

export type PlannedOccurrence = {
  date: string;
  time: string;
  startAt: string;
  endAt: string;
  /** já existe atendimento da profissional que cruza este horário */
  conflict: boolean;
};

/** Datas já com início/fim em UTC e a marca de conflito, para a tela de conferência antes de criar. */
export function planOccurrences(
  rule: RecurrenceRule,
  time: string,
  durationMinutes: number,
  busy: BusyInterval[],
  range: { from: string; until: string },
): PlannedOccurrence[] {
  return occurrenceDates(rule, range).map((date) => {
    const start = zonedDateTimeToUtc(date, time);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    return { date, time, startAt: start.toISOString(), endAt: end.toISOString(), conflict: overlapsBusy(date, time, durationMinutes, busy) };
  });
}

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** "Toda terça-feira", "Todo dia 15", "A cada 10 dias" (para a ficha e o detalhe do atendimento). */
export function describeRule(rule: Pick<RecurrenceRule, "frequency" | "intervalDays" | "startDate">): string {
  switch (rule.frequency) {
    case "weekly": {
      const day = WEEKDAYS[weekdayOf(rule.startDate)];
      const feminine = day !== "sábado" && day !== "domingo";
      return `${feminine ? "Toda" : "Todo"} ${day}`;
    }
    case "monthly": {
      const day = Number(rule.startDate.slice(8));
      return day >= 29 ? `Todo mês, no dia ${day} (ou no último dia)` : `Todo dia ${day}`;
    }
    case "every_days": {
      const n = rule.intervalDays ?? 1;
      return n === 1 ? "Todos os dias" : `A cada ${n} dias`;
    }
  }
}

/** Regra válida para criar? (datas existem, X entre 1 e 365 só em "a cada X dias", fim depois do início) */
export function isRuleValid(rule: Pick<RecurrenceRule, "frequency" | "intervalDays" | "startDate" | "endDate">): boolean {
  if (!isValidDateString(rule.startDate)) return false;
  if (rule.endDate !== null && (!isValidDateString(rule.endDate) || rule.endDate < rule.startDate)) return false;
  if (rule.frequency === "every_days") return Number.isInteger(rule.intervalDays) && (rule.intervalDays as number) >= 1 && (rule.intervalDays as number) <= 365;
  return rule.intervalDays === null;
}
