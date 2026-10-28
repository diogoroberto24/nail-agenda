"use server";

import { getCurrentProfessional } from "@/lib/auth/session";
import { getLanguageModel } from "@/lib/ai/model";
import { classifyAiError, interpretBookingText } from "@/lib/ai/booking";
import { BOOKING_TEXT_MAX, type BookingSuggestion } from "@/lib/ai/booking-types";
import { searchActiveClients } from "@/lib/data/appointments";
import { listServicesOf } from "@/lib/data/services";
import { formatBrazilPhone } from "@/lib/phone";
import { toZonedParts } from "@/lib/timezone";

export type InterpretResult =
  | { ok: true; suggestion: BookingSuggestion }
  | { ok: false; error: string };

const ERRORS = {
  session: "Sua sessão expirou. Entre novamente.",
  disabled: "O agendamento por texto não está configurado neste ambiente.",
  empty: "Escreva o agendamento, por exemplo: \"Ana sexta 14h pé e mão\".",
  long: `Use até ${BOOKING_TEXT_MAX} caracteres.`,
  quota: "O limite de uso da IA foi atingido. Tente de novo em alguns minutos ou agende pelo passo a passo.",
  unavailable: "Não consegui interpretar agora. Tente de novo ou agende pelo passo a passo.",
} as const;

/**
 * Interpreta o texto do agendamento com IA. Não grava nada: devolve uma sugestão já conferida contra
 * o banco, que a tela usa para preencher o rascunho do agendamento.
 * As buscas rodam com o cliente Supabase da usuária, então a RLS vale também para o que a IA consulta.
 */
export async function interpretBookingTextAction(text: string): Promise<InterpretResult> {
  const me = await getCurrentProfessional();
  if (!me) return { ok: false, error: ERRORS.session };

  const model = getLanguageModel();
  if (!model) return { ok: false, error: ERRORS.disabled };

  const input = String(text ?? "").trim();
  if (!input) return { ok: false, error: ERRORS.empty };
  if (input.length > BOOKING_TEXT_MAX) return { ok: false, error: ERRORS.long };

  const services = (await listServicesOf(me.professionalId))
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name, durationMinutes: s.default_duration_minutes, price: Number(s.default_price) }));
  const { date: today, time: now } = toZonedParts(new Date());

  try {
    const suggestion = await interpretBookingText(input, {
      model,
      today,
      now,
      professionalName: me.displayName,
      services,
      searchClients: async (term) =>
        (await searchActiveClients(term.slice(0, 60), 5)).map((c) => ({
          id: c.id,
          name: c.full_name,
          phone: formatBrazilPhone(c.phone),
        })),
    });
    return { ok: true, suggestion };
  } catch (error) {
    console.error("[ia] agendamento por texto falhou:", error instanceof Error ? error.message : error);
    return { ok: false, error: ERRORS[classifyAiError(error)] };
  }
}
