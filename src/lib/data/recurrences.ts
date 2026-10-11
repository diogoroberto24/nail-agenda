import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/data/clients";
import { RECURRENCE_COLUMNS, type RecurrenceRow } from "@/lib/recurrence/service";

export type RecurrenceItem = RecurrenceRow & {
  services: { name: string } | null;
  clients: { id: string; full_name: string } | null;
};

const WITH_RELATIONS = `${RECURRENCE_COLUMNS}, services(name), clients(id, full_name)`;

/** Recorrências ATIVAS da profissional logada para uma cliente (a RLS já limita às dela). */
export async function listActiveRecurrencesOfClient(clientId: string): Promise<RecurrenceItem[]> {
  if (!isUuid(clientId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurrences")
    .select(WITH_RELATIONS)
    .eq("client_id", clientId)
    .is("ended_at", null)
    .order("start_date", { ascending: true });
  if (error) throw new Error("Não foi possível carregar as recorrências.");
  return (data ?? []) as unknown as RecurrenceItem[];
}

export async function getRecurrence(id: string): Promise<RecurrenceItem | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurrences").select(WITH_RELATIONS).eq("id", id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar a recorrência.");
  return (data ?? null) as unknown as RecurrenceItem | null;
}

/** Ids das clientes que têm recorrência ativa com a profissional logada (para a etiqueta na lista). */
export async function listClientIdsWithActiveRecurrence(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurrences").select("client_id").is("ended_at", null).limit(1000);
  if (error) throw new Error("Não foi possível carregar as recorrências.");
  return new Set((data ?? []).map((r) => r.client_id as string));
}

export type SeriesOccurrence = { id: string; start_at: string; end_at: string; status: string; occurrence_date: string };

/** Próximos atendimentos da série (que ainda não terminaram e não foram cancelados). */
export async function listUpcomingOccurrences(recurrenceId: string, now: Date, limit = 60): Promise<SeriesOccurrence[]> {
  if (!isUuid(recurrenceId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, start_at, end_at, status, occurrence_date")
    .eq("recurrence_id", recurrenceId)
    .neq("status", "cancelled")
    .gte("end_at", now.toISOString())
    .order("start_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error("Não foi possível carregar os atendimentos da recorrência.");
  return (data ?? []) as SeriesOccurrence[];
}
