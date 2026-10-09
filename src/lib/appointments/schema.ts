import { z } from "zod";
import { MAX_PRICE, parsePrice } from "@/lib/money";
import { MAX_DURATION, MIN_DURATION } from "@/lib/services/schema";
import { isValidDateString, isValidTimeString, zonedDateTimeToUtc } from "@/lib/timezone";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valores como digitados no formulário de agendamento (tudo texto). */
export const appointmentSchema = z.object({
  clientId: z.string().regex(UUID, "Escolha a cliente."),
  serviceId: z.string().regex(UUID, "Escolha o serviço."),
  date: z.string().refine(isValidDateString, "Informe uma data válida."),
  time: z.string().refine(isValidTimeString, "Informe um horário válido."),
  durationMinutes: z
    .string()
    .trim()
    .min(1, "Informe a duração em minutos.")
    .refine((v) => /^\d+$/.test(v), "Use só números, ex.: 40.")
    .refine(
      (v) => Number(v) >= MIN_DURATION && Number(v) <= MAX_DURATION,
      `A duração deve ficar entre ${MIN_DURATION} e ${MAX_DURATION} minutos.`,
    ),
  price: z
    .string()
    .trim()
    .min(1, "Informe o preço.")
    .refine((v) => parsePrice(v) !== null, "Preço inválido. Ex.: 50 ou 50,00.")
    .refine((v) => {
      const p = parsePrice(v);
      return p === null || (p >= 0 && p <= MAX_PRICE);
    }, "O preço deve estar entre R$ 0,00 e R$ 99.999,99."),
  notes: z.string().trim().max(500, "As observações estão muito longas (máx. 500 caracteres).").optional(),
});

export type AppointmentFormValues = z.infer<typeof appointmentSchema>;

/** Calcula os campos de tempo e valor que vão para o banco. O horário final é sempre início + duração. */
export function toAppointmentTimes(values: Pick<AppointmentFormValues, "date" | "time" | "durationMinutes">, timeZone?: string) {
  const start = zonedDateTimeToUtc(values.date, values.time, timeZone);
  const minutes = Number(values.durationMinutes);
  const end = new Date(start.getTime() + minutes * 60_000);
  return { start, end, minutes };
}

export function toAppointmentRow(values: AppointmentFormValues, timeZone?: string) {
  const { start, end, minutes } = toAppointmentTimes(values, timeZone);
  return {
    client_id: values.clientId,
    service_id: values.serviceId,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    duration_minutes_at_booking: minutes,
    price_at_booking: parsePrice(values.price) as number,
    notes: values.notes ? values.notes : null,
  };
}
