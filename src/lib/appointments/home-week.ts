import { addDays, startOfWeek, zonedDateTimeToUtc } from "@/lib/timezone";

/**
 * Na tela Início, os atendimentos gerados por uma RECORRÊNCIA só entram se forem da semana atual
 * (segunda a domingo); os 6 meses reservados à frente não enchem a lista nem o contador de pendências.
 * Atendimentos avulsos não mudam.
 */

/** Primeiro instante DEPOIS da semana atual (segunda 00:00 da semana seguinte), no fuso do salão. */
export function weekEndUtc(today: string): Date {
  return zonedDateTimeToUtc(addDays(startOfWeek(today, 1), 7), "00:00");
}

/** Filtro do PostgREST: atendimento avulso, ou de recorrência que começa antes do fim da semana. */
export function recurrenceWeekFilter(until: Date): string {
  return `recurrence_id.is.null,start_at.lt.${until.toISOString()}`;
}

/** Aplica o filtro a uma consulta do Supabase (qualquer builder que aceite `.or`). */
export function limitRecurrencesToWeek<Q extends { or: (filter: string) => Q }>(query: Q, until: Date): Q {
  return query.or(recurrenceWeekFilter(until));
}
