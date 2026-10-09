import { z } from "zod";
import { MAX_PRICE, parsePrice } from "@/lib/money";

export const MIN_DURATION = 5;
export const MAX_DURATION = 720;

/** Valores como digitados no formulário (tudo texto). */
export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do serviço.").max(80, "O nome está muito longo."),
  description: z.string().trim().max(300, "A descrição está muito longa (máx. 300 caracteres).").optional(),
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
});

export type ServiceFormValues = z.infer<typeof serviceSchema>;

/** Converte os valores validados no formato gravado no banco. */
export function toServiceRow(values: ServiceFormValues) {
  return {
    name: values.name,
    description: values.description ? values.description : null,
    default_duration_minutes: Number(values.durationMinutes),
    default_price: parsePrice(values.price) as number,
  };
}
