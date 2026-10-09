"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfessional } from "@/lib/auth/session";
import { clientSchema, toClientRow } from "@/lib/clients/schema";
import { findClientsByPhone, isUuid } from "@/lib/data/clients";
import { normalizeBrazilPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export type DuplicateClient = { id: string; fullName: string; archived: boolean };

export type SaveClientResult =
  | { ok: true; id: string }
  | { ok: false; code: "duplicate"; duplicates: DuplicateClient[] }
  | { ok: false; code: "error"; error: string };

const SESSION_EXPIRED = "Sua sessão expirou. Entre novamente.";
const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";

function toDuplicates(rows: { id: string; full_name: string; archived_at: string | null }[]): DuplicateClient[] {
  return rows.map((r) => ({ id: r.id, fullName: r.full_name, archived: r.archived_at !== null }));
}

/** Verifica, durante o preenchimento, se o telefone já está cadastrado. */
export async function checkClientPhoneAction(phone: string, excludeId?: string): Promise<DuplicateClient[]> {
  const me = await getCurrentProfessional();
  if (!me) return [];
  const normalized = normalizeBrazilPhone(String(phone ?? ""));
  if (!normalized) return [];
  return toDuplicates(await findClientsByPhone(normalized, excludeId));
}

export async function createClientAction(values: unknown, allowDuplicate: boolean): Promise<SaveClientResult> {
  const me = await getCurrentProfessional();
  if (!me) return { ok: false, code: "error", error: SESSION_EXPIRED };

  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return { ok: false, code: "error", error: "Confira os campos e tente de novo." };
  const row = toClientRow(parsed.data);

  if (!allowDuplicate) {
    const duplicates = await findClientsByPhone(row.phone);
    if (duplicates.length) return { ok: false, code: "duplicate", duplicates: toDuplicates(duplicates) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({ salon_id: me.salonId, ...row })
    .select("id")
    .single();
  if (error || !data) return { ok: false, code: "error", error: GENERIC_ERROR };

  revalidatePath("/clientes");
  return { ok: true, id: data.id };
}

export async function updateClientAction(
  id: string,
  values: unknown,
  allowDuplicate: boolean,
): Promise<SaveClientResult> {
  const me = await getCurrentProfessional();
  if (!me) return { ok: false, code: "error", error: SESSION_EXPIRED };
  if (!isUuid(id)) return { ok: false, code: "error", error: "Cliente não encontrada." };

  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return { ok: false, code: "error", error: "Confira os campos e tente de novo." };
  const row = toClientRow(parsed.data);

  if (!allowDuplicate) {
    const duplicates = await findClientsByPhone(row.phone, id);
    if (duplicates.length) return { ok: false, code: "duplicate", duplicates: toDuplicates(duplicates) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").update(row).eq("id", id).select("id");
  if (error) return { ok: false, code: "error", error: GENERIC_ERROR };
  if (!data?.length) return { ok: false, code: "error", error: "Cliente não encontrada." };

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { ok: true, id };
}

/** Arquiva (ou reativa) uma cliente. Nunca apaga: o histórico de atendimentos é preservado. */
export async function setClientArchivedAction(
  id: string,
  archived: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await getCurrentProfessional();
  if (!me) return { ok: false, error: SESSION_EXPIRED };
  if (!isUuid(id)) return { ok: false, error: "Cliente não encontrada." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: GENERIC_ERROR };
  if (!data?.length) return { ok: false, error: "Cliente não encontrada." };

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { ok: true };
}
