/** Fuso de referência do salão. Os horários ficam em UTC no banco e são exibidos neste fuso. */
export const SALON_TIMEZONE = "America/Sao_Paulo";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SALON_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateOnly = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SALON_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "2026-11-10T13:00:00Z" → "10/11/2026 10:00" */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso)).replace(",", "");
}

/** "2026-11-10T13:00:00Z" → "10/11/2026" */
export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso));
}

/** 90 → "1h30", 40 → "40 min", 120 → "2h" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
