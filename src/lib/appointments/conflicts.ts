import type { AppointmentStatus } from "./status";

/**
 * Status que ocupam o horário da profissional. Cancelado libera o horário.
 * "Não compareceu" também libera: a cliente não veio, o horário ficou livre.
 */
export const OCCUPYING_STATUSES: readonly AppointmentStatus[] = ["awaiting_confirmation", "confirmed", "completed"];

export function occupiesSlot(status: AppointmentStatus): boolean {
  return OCCUPYING_STATUSES.includes(status);
}

/**
 * Dois intervalos se sobrepõem? Intervalos semiabertos [início, fim): um atendimento que
 * termina às 10:40 e outro que começa às 10:40 NÃO se sobrepõem.
 */
export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export type Slot = { id: string; start_at: string; end_at: string; status: AppointmentStatus };

/** Atendimentos de `others` que ocupam horário e se sobrepõem ao intervalo candidato. */
export function findOverlaps<T extends Slot>(candidateStart: Date, candidateEnd: Date, others: T[], excludeId?: string): T[] {
  return others.filter(
    (o) =>
      o.id !== excludeId &&
      occupiesSlot(o.status) &&
      intervalsOverlap(candidateStart, candidateEnd, new Date(o.start_at), new Date(o.end_at)),
  );
}
