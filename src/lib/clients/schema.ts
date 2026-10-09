import { z } from "zod";
import { normalizeBrazilPhone } from "@/lib/phone";

/** Valores como digitados no formulário (tudo texto). */
export const clientSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Informe o nome completo.")
    .max(120, "O nome está muito longo."),
  phone: z
    .string()
    .trim()
    .min(1, "Informe o telefone com DDD.")
    .refine((v) => normalizeBrazilPhone(v) !== null, "Telefone inválido. Use DDD + número, ex.: (11) 99999-8888."),
  notes: z.string().trim().max(500, "As observações estão muito longas (máx. 500 caracteres).").optional(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

/** Converte os valores validados no formato gravado no banco. */
export function toClientRow(values: ClientFormValues) {
  return {
    full_name: values.fullName,
    phone: normalizeBrazilPhone(values.phone) as string,
    notes: values.notes ? values.notes : null,
  };
}
