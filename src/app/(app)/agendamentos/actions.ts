"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfessional } from "@/lib/auth/session";
import {
  checkConflicts,
  createAppointment,
  setAppointmentStatus,
  updateAppointment,
  type ConflictInfo,
  type SaveAppointmentResult,
  type SetStatusResult,
} from "@/lib/appointments/service";
import type { AppointmentStatus } from "@/lib/appointments/status";
import { listBusyIntervals, searchActiveClients } from "@/lib/data/appointments";
import type { BusyInterval } from "@/lib/appointments/slots";
import { addDays, isValidDateString, zonedDayRange } from "@/lib/timezone";
import { formatBrazilPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export type { ConflictInfo, SaveAppointmentResult, SetStatusResult };
export type PickerClient = { id: string; fullName: string; phone: string };

const SESSION_EXPIRED = "Sua sessão expirou. Entre novamente.";

/** Busca clientes ativas para o seletor (nome ou telefone). */
export async function searchClientsAction(q: string): Promise<PickerClient[]> {
  const me = await getCurrentProfessional();
  if (!me) return [];
  const rows = await searchActiveClients(String(q ?? "").slice(0, 80));
  return rows.map((c) => ({ id: c.id, fullName: c.full_name, phone: formatBrazilPhone(c.phone) }));
}

/** Aviso de sobreposição em tempo real (não bloqueia). */
export async function checkConflictsAction(input: {
  date: string;
  time: string;
  durationMinutes: string;
  excludeId?: string;
}): Promise<ConflictInfo[]> {
  const me = await getCurrentProfessional();
  if (!me) return [];
  return checkConflicts(await createClient(), me, input);
}

export async function createAppointmentAction(
  id: string,
  values: unknown,
  confirmConflict: boolean,
): Promise<SaveAppointmentResult> {
  const me = await getCurrentProfessional();
  if (!me) return { ok: false, code: "error", error: SESSION_EXPIRED };

  const result = await createAppointment(await createClient(), me, id, values, confirmConflict);
  if (result.ok) {
    revalidatePath("/agenda");
    revalidatePath("/clientes");
  }
  return result;
}

export async function updateAppointmentAction(
  id: string,
  values: unknown,
  confirmConflict: boolean,
): Promise<SaveAppointmentResult> {
  const me = await getCurrentProfessional();
  if (!me) return { ok: false, code: "error", error: SESSION_EXPIRED };

  const result = await updateAppointment(await createClient(), me, id, values, confirmConflict);
  if (result.ok) {
    revalidatePath("/agenda");
    revalidatePath(`/agendamentos/${id}`);
    revalidatePath("/clientes");
  }
  return result;
}

/** Confirmar, concluir, não compareceu ou cancelar. Cancelar libera o horário. */
export async function setAppointmentStatusAction(
  id: string,
  next: AppointmentStatus,
  expectedCurrent?: AppointmentStatus,
): Promise<SetStatusResult> {
  const me = await getCurrentProfessional();
  if (!me) return { ok: false, error: SESSION_EXPIRED };

  const result = await setAppointmentStatus(await createClient(), me, id, next, expectedCurrent);
  // mesmo quando falha por mudança em outro aparelho, a tela precisa recarregar o estado real
  revalidatePath("/agenda");
  revalidatePath("/");
  revalidatePath(`/agendamentos/${id}`);
  revalidatePath("/clientes");
  return result;
}

/** Horários ocupados da própria profissional na semana que começa em `weekStart` (segunda). */
export async function listBusyWeekAction(weekStart: string): Promise<BusyInterval[]> {
  const me = await getCurrentProfessional();
  if (!me || !isValidDateString(String(weekStart))) return [];
  const from = zonedDayRange(weekStart).start;
  const to = zonedDayRange(addDays(weekStart, 6)).end;
  return listBusyIntervals(me.professionalId, from, to);
}
