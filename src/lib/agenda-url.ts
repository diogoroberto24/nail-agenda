import { isValidDateString } from "@/lib/timezone";

/** Monta o link da agenda preservando data, profissional e (opcionalmente) o atendimento em destaque. */
export function agendaHref({ date, pro, highlight }: { date?: string; pro?: string; highlight?: string }): string {
  const params = new URLSearchParams();
  if (date) params.set("data", date);
  if (pro && pro !== "todas") params.set("pro", pro);
  if (highlight) params.set("destaque", highlight);
  const qs = params.toString();
  return qs ? `/agenda?${qs}` : "/agenda";
}

/** Lê o parâmetro ?data= e devolve uma data válida ou o fallback. */
export function parseDateParam(value: string | string[] | undefined, fallback: string): string {
  const v = Array.isArray(value) ? value[0] : value;
  return v && isValidDateString(v) ? v : fallback;
}
