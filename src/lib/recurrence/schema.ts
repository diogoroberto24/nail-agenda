import { z } from "zod";
import { MAX_PRICE, parsePrice } from "@/lib/money";
import { MAX_DURATION, MIN_DURATION } from "@/lib/services/schema";
import { isValidDateString, isValidTimeString } from "@/lib/timezone";
import type { RecurrenceRule } from "@/lib/recurrence/rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Observações da recorrência (e dos atendimentos gerados): mesmo limite do passo a passo de agendamento. */
export const RECURRENCE_NOTES_MAX = 200;

/** Valores como digitados no formulário de recorrência (tudo texto). */
export const recurrenceSchema = z
  .object({
    clientId: z.string().regex(UUID, "Escolha a cliente."),
    serviceId: z.string().regex(UUID, "Escolha o serviço."),
    frequency: z.enum(["weekly", "monthly", "every_days"], { message: "Escolha como repete." }),
    /** só para "a cada X dias" */
    intervalDays: z.string().trim().optional(),
    startDate: z.string().refine(isValidDateString, "Informe a data do primeiro atendimento."),
    time: z.string().refine(isValidTimeString, "Informe um horário válido."),
    durationMinutes: z
      .string()
      .trim()
      .min(1, "Informe a duração em minutos.")
      .refine((v) => /^\d+$/.test(v), "Use só números, ex.: 40.")
      .refine((v) => Number(v) >= MIN_DURATION && Number(v) <= MAX_DURATION, `A duração deve ficar entre ${MIN_DURATION} e ${MAX_DURATION} minutos.`),
    price: z
      .string()
      .trim()
      .min(1, "Informe o preço.")
      .refine((v) => parsePrice(v) !== null, "Preço inválido. Ex.: 50 ou 50,00.")
      .refine((v) => {
        const p = parsePrice(v);
        return p === null || (p >= 0 && p <= MAX_PRICE);
      }, "O preço deve estar entre R$ 0,00 e R$ 99.999,99."),
    notes: z.string().trim().max(RECURRENCE_NOTES_MAX, `As observações aceitam até ${RECURRENCE_NOTES_MAX} caracteres.`).optional(),
    /** vazio = sem fim (repõe sempre 6 meses à frente) */
    endDate: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.frequency === "every_days") {
      const x = (v.intervalDays ?? "").trim();
      if (!/^\d+$/.test(x) || Number(x) < 1 || Number(x) > 365) {
        ctx.addIssue({ code: "custom", path: ["intervalDays"], message: "Informe de quantos em quantos dias (1 a 365)." });
      }
    }
    if (v.endDate) {
      if (!isValidDateString(v.endDate)) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Data final inválida." });
      else if (isValidDateString(v.startDate) && v.endDate < v.startDate) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: "A data final precisa ser depois do primeiro atendimento." });
      }
    }
  });

export type RecurrenceFormValues = z.infer<typeof recurrenceSchema>;

/** Valores validados → regra de datas. */
export function toRule(values: RecurrenceFormValues, skippedDates: readonly string[] = []): RecurrenceRule {
  return {
    frequency: values.frequency,
    intervalDays: values.frequency === "every_days" ? Number(values.intervalDays) : null,
    startDate: values.startDate,
    endDate: values.endDate ? values.endDate : null,
    skippedDates,
  };
}

/** Valores validados → linha da tabela recurrences (sem os campos de identidade). */
export function toRecurrenceRow(values: RecurrenceFormValues, skippedDates: readonly string[]) {
  const rule = toRule(values, skippedDates);
  return {
    client_id: values.clientId,
    service_id: values.serviceId,
    frequency: rule.frequency,
    interval_days: rule.intervalDays,
    start_date: rule.startDate,
    start_time: values.time,
    duration_minutes: Number(values.durationMinutes),
    price: parsePrice(values.price) as number,
    notes: values.notes ? values.notes : null,
    end_date: rule.endDate,
    skipped_dates: [...skippedDates],
  };
}
