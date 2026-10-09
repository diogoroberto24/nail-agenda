import type { AppointmentStatus } from "./status";

/**
 * Mudanças de status permitidas. São sempre manuais: o sistema nunca marca um atendimento como
 * concluído só porque o horário passou, e abrir o WhatsApp não altera o status.
 *
 * Concluído e "não compareceu" podem ser REABERTOS (voltam para "confirmado"), para corrigir um
 * toque errado. Cancelado é definitivo: o atendimento sai da agenda e o horário é liberado.
 */
const TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  awaiting_confirmation: ["confirmed", "completed", "no_show", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  completed: ["confirmed"],
  no_show: ["confirmed"],
  cancelled: [],
};

export function allowedTransitions(from: AppointmentStatus): readonly AppointmentStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Sem nenhuma mudança possível (só cancelado). */
export function isFinalStatus(status: AppointmentStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Atendimento que ainda vai acontecer: pode ser editado/remarcado e recebe a mensagem de confirmação. */
export function isOpenStatus(status: AppointmentStatus): boolean {
  return status === "awaiting_confirmation" || status === "confirmed";
}

/** Reabrir: concluído ou "não compareceu" voltando para confirmado. */
export function isReopen(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return (from === "completed" || from === "no_show") && to === "confirmed";
}
