"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfessional } from "@/lib/auth/session";
import { changeRecurrenceFrom, createRecurrence, endRecurrence, previewRecurrence, topUpRecurrences } from "@/lib/recurrence/service";
import type { ChangeResult, CreateResult, EndResult, PreviewResult } from "@/lib/recurrence/service";
import { createClient } from "@/lib/supabase/server";

const SESSION_EXPIRED = "Sua sessão expirou. Entre novamente.";

function refresh(clientId?: string) {
  revalidatePath("/agenda");
  revalidatePath("/");
  revalidatePath("/clientes");
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}

/** Mostra as datas (com conflitos) antes de criar ou alterar. Não grava nada. */
export async function previewRecurrenceAction(values: unknown, ignore?: { recurrenceId: string; fromDate: string }): Promise<PreviewResult> {
  const me = await getCurrentProfessional();
  if (!me) return { ok: false, error: SESSION_EXPIRED };
  return previewRecurrence(await createClient(), me, values, { ignore });
}

export async function createRecurrenceAction(id: string, values: unknown, skippedDates: string[]): Promise<CreateResult> {
  const me = await getCurrentProfessional();
  if (!me) return { ok: false, error: SESSION_EXPIRED };
  const result = await createRecurrence(await createClient(), me, id, values, Array.isArray(skippedDates) ? skippedDates : []);
  if (result.ok) refresh((values as { clientId?: string })?.clientId);
  return result;
}

export async function changeRecurrenceAction(oldId: string, newId: string, values: unknown, skippedDates: string[]): Promise<ChangeResult> {
  const me = await getCurrentProfessional();
  if (!me) return { ok: false, error: SESSION_EXPIRED };
  const result = await changeRecurrenceFrom(await createClient(), me, oldId, newId, values, Array.isArray(skippedDates) ? skippedDates : []);
  if (result.ok) {
    refresh((values as { clientId?: string })?.clientId);
    revalidatePath(`/recorrencias/${oldId}`);
  }
  return result;
}

export async function endRecurrenceAction(id: string, clientId?: string): Promise<EndResult> {
  const me = await getCurrentProfessional();
  if (!me) return { ok: false, error: SESSION_EXPIRED };
  const result = await endRecurrence(await createClient(), me, id);
  if (result.ok) {
    refresh(clientId);
    revalidatePath(`/recorrencias/${id}`);
  }
  return result;
}

/** Repõe os atendimentos que faltam (6 meses à frente) nas recorrências da profissional. Roda ao abrir o app. */
export async function topUpRecurrencesAction(): Promise<{ created: number }> {
  const me = await getCurrentProfessional();
  if (!me) return { created: 0 };
  try {
    const result = await topUpRecurrences(await createClient(), me);
    if (result.created > 0) refresh();
    return result;
  } catch {
    return { created: 0 };
  }
}
