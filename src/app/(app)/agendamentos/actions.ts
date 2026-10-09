"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfessional } from "@/lib/auth/session";
import {
  checkConflicts,
  createAppointment,
  updateAppointment,
  type ConflictInfo,
  type SaveAppointmentResult,
} from "@/lib/appointments/service";
import { searchActiveClients } from "@/lib/data/appointments";
import { formatBrazilPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export type { ConflictInfo, SaveAppointmentResult };
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
