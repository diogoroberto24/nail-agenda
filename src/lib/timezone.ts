/**
 * Datas e horas no fuso do salão (America/Sao_Paulo).
 * O banco guarda instantes em UTC; a tela e os formulários trabalham com "data local" (YYYY-MM-DD)
 * e "hora local" (HH:mm) do salão. Estas funções convertem entre os dois mundos sem depender do
 * fuso do aparelho de quem usa.
 */
import { SALON_TIMEZONE } from "./datetime";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDateString(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function isValidTimeString(value: string): boolean {
  return TIME_RE.test(value);
}

/** Soma dias a uma data local ("2026-11-30" + 1 → "2026-12-01"). */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Dia da semana de uma data local: 0 = domingo ... 6 = sábado. */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Domingo da semana que contém a data. */
export function startOfWeek(dateStr: string): string {
  return addDays(dateStr, -weekdayOf(dateStr));
}

function offsetMs(utc: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utc);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utc.getTime() / 1000) * 1000;
}

/** "2026-11-10" + "10:00" no fuso do salão → instante UTC. */
export function zonedDateTimeToUtc(dateStr: string, timeStr: string, timeZone = SALON_TIMEZONE): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // duas passadas cobrem trocas de horário de verão
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** Intervalo [início, fim) em UTC que cobre o dia local inteiro. */
export function zonedDayRange(dateStr: string, timeZone = SALON_TIMEZONE): { start: Date; end: Date } {
  return {
    start: zonedDateTimeToUtc(dateStr, "00:00", timeZone),
    end: zonedDateTimeToUtc(addDays(dateStr, 1), "00:00", timeZone),
  };
}

/** Instante UTC → data e hora locais do salão. */
export function toZonedParts(instant: Date | string, timeZone = SALON_TIMEZONE): { date: string; time: string } {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Data local de hoje no fuso do salão. */
export function todayInZone(timeZone = SALON_TIMEZONE, now: Date = new Date()): string {
  return toZonedParts(now, timeZone).date;
}

/** "10:00" a partir de um instante, no fuso do salão. */
export function formatTime(instant: Date | string, timeZone = SALON_TIMEZONE): string {
  return toZonedParts(instant, timeZone).time;
}

const longDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const shortWeekday = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short" });

function noonUtc(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** "2026-11-10" → "terça-feira, 10 de novembro" */
export function formatLongDate(dateStr: string): string {
  return longDate.format(noonUtc(dateStr));
}

/** "2026-11-10" → "ter" */
export function formatShortWeekday(dateStr: string): string {
  return shortWeekday.format(noonUtc(dateStr)).replace(".", "");
}

/** "2026-11-10" → "10/11/2026" */
export function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
