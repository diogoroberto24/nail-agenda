"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfessional } from "@/lib/auth/session";
import { isUuid } from "@/lib/data/clients";
import { serviceSchema, toServiceRow } from "@/lib/services/schema";
import { createClient } from "@/lib/supabase/server";

export type SaveServiceResult = { ok: true; id: string } | { ok: false; error: string };

const SESSION_EXPIRED = "Sua sessão expirou. Entre novamente.";
const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";

/** Cria um serviço PARA A PROFISSIONAL LOGADA (nunca para a colega). */
export async function createServiceAction(values: unknown): Promise<SaveServiceResult> {
  const me = await getCurrentProfessional();
  if (!me) return { ok: false, error: SESSION_EXPIRED };

  const parsed = serviceSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Confira os campos e tente de novo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .insert({ salon_id: me.salonId, professional_id: me.professionalId, ...toServiceRow(parsed.data) })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: GENERIC_ERROR };

  revalidatePath("/servicos");
  return { ok: true, id: data.id };
}

/** Altera só serviços da própria profissional; o preço de atendimentos já marcados não muda. */
export async function updateServiceAction(id: string, values: unknown): Promise<SaveServiceResult> {
  const me = await getCurrentProfessional();
  if (!me) return { ok: false, error: SESSION_EXPIRED };
  if (!isUuid(id)) return { ok: false, error: "Serviço não encontrado." };

  const parsed = serviceSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Confira os campos e tente de novo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .update(toServiceRow(parsed.data))
    .eq("id", id)
    .eq("professional_id", me.professionalId)
    .select("id");
  if (error) return { ok: false, error: GENERIC_ERROR };
  if (!data?.length) return { ok: false, error: "Serviço não encontrado." };

  revalidatePath("/servicos");
  return { ok: true, id };
}

/** Desativa (ou reativa) um serviço. Serviços inativos continuam no histórico. */
export async function setServiceActiveAction(
  id: string,
  active: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await getCurrentProfessional();
  if (!me) return { ok: false, error: SESSION_EXPIRED };
  if (!isUuid(id)) return { ok: false, error: "Serviço não encontrado." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .update({ active })
    .eq("id", id)
    .eq("professional_id", me.professionalId)
    .select("id");
  if (error) return { ok: false, error: GENERIC_ERROR };
  if (!data?.length) return { ok: false, error: "Serviço não encontrado." };

  revalidatePath("/servicos");
  return { ok: true };
}
