import "server-only";
import { createClient } from "@/lib/supabase/server";
import { birthdayPairsFor } from "@/lib/clients/birthday";
import { buildClientSearchFilter } from "@/lib/clients/search";
import type { AppointmentStatus } from "@/lib/appointments/status";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

export type ClientRow = {
  id: string;
  full_name: string;
  phone: string;
  notes: string | null;
  archived_at: string | null;
  birth_day: number | null;
  birth_month: number | null;
  birth_year: number | null;
};

const CLIENT_COLUMNS = "id, full_name, phone, notes, archived_at, birth_day, birth_month, birth_year";

/**
 * Lista clientes do salão (a RLS já restringe ao salão da usuária).
 * Busca por nome ou telefone. `archived: true` mostra só as arquivadas.
 */
export async function listClients({ q, archived }: { q?: string; archived?: boolean }): Promise<ClientRow[]> {
  const supabase = await createClient();
  let query = supabase.from("clients").select(CLIENT_COLUMNS).limit(500);
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  const filter = buildClientSearchFilter(q ?? "");
  if (filter) query = query.or(filter);

  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar os clientes.");
  // ordena em JS para respeitar acentos e maiúsculas do português
  return (data ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR", { sensitivity: "base" }));
}

export async function getClient(id: string): Promise<ClientRow | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select(CLIENT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar a cliente.");
  return data;
}

/** Cadastros existentes com o mesmo telefone (inclui arquivados). */
export async function findClientsByPhone(phone: string, excludeId?: string) {
  const supabase = await createClient();
  let query = supabase.from("clients").select("id, full_name, archived_at").eq("phone", phone).limit(5);
  if (excludeId && isUuid(excludeId)) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw new Error("Não foi possível verificar o telefone.");
  return data ?? [];
}

export type ClientHistoryItem = {
  id: string;
  start_at: string;
  status: AppointmentStatus;
  price_at_booking: string | number;
  duration_minutes_at_booking: number;
  professionals: { display_name: string } | null;
  services: { name: string } | null;
};

/** Histórico em ordem cronológica (mais recente primeiro). Inclui cancelados: o histórico guarda tudo. */
export async function getClientHistory(clientId: string): Promise<ClientHistoryItem[]> {
  if (!isUuid(clientId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, start_at, status, price_at_booking, duration_minutes_at_booking, professionals(display_name), services(name)",
    )
    .eq("client_id", clientId)
    .order("start_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("Não foi possível carregar o histórico.");
  return (data ?? []) as unknown as ClientHistoryItem[];
}

export type BirthdayClient = { id: string; full_name: string; phone: string; birth_year: number | null };

/**
 * Clientes ativas que fazem aniversário hoje (todas as do salão: o cadastro é compartilhado).
 * Em 28/02 de ano não bissexto inclui quem faz aniversário em 29/02.
 */
export async function listBirthdaysToday(today: string): Promise<BirthdayClient[]> {
  const pairs = birthdayPairsFor(today);
  const supabase = await createClient();
  const filter = pairs.map((p) => `and(birth_day.eq.${p.day},birth_month.eq.${p.month})`).join(",");
  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name, phone, birth_year")
    .is("archived_at", null)
    .or(filter)
    .limit(100);
  if (error) throw new Error("Não foi possível carregar os aniversariantes.");
  return (data ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR", { sensitivity: "base" }));
}
