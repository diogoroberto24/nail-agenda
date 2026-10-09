import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/data/clients";
import type { AppointmentStatus } from "@/lib/appointments/status";

export type AppointmentItem = {
  id: string;
  professional_id: string;
  client_id: string;
  service_id: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  duration_minutes_at_booking: number;
  price_at_booking: string | number;
  notes: string | null;
  clients: { id: string; full_name: string; phone: string } | null;
  services: { name: string } | null;
  professionals: { display_name: string } | null;
};

const APPOINTMENT_SELECT =
  "id, professional_id, client_id, service_id, start_at, end_at, status, duration_minutes_at_booking, price_at_booking, notes, " +
  "clients(id, full_name, phone), services(name), professionals(display_name)";

/**
 * Atendimentos no intervalo [from, to), do mais cedo para o mais tarde.
 * Cancelados ficam de fora: eles saem da agenda (continuam no banco e no histórico da cliente).
 */
export async function listAppointmentsInRange(from: Date, to: Date): Promise<AppointmentItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .gte("start_at", from.toISOString())
    .lt("start_at", to.toISOString())
    .neq("status", "cancelled")
    .order("start_at", { ascending: true })
    .limit(500);
  if (error) throw new Error("Não foi possível carregar a agenda.");
  return (data ?? []) as unknown as AppointmentItem[];
}

export async function getAppointment(id: string): Promise<AppointmentItem | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("appointments").select(APPOINTMENT_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar o atendimento.");
  return (data ?? null) as unknown as AppointmentItem | null;
}

/** Busca clientes ativas para o seletor do agendamento. */
export async function searchActiveClients(q: string, limit = 8) {
  const supabase = await createClient();
  const term = q.replace(/[,()*%_\\"]/g, " ").replace(/\s+/g, " ").trim();
  const digits = term.replace(/\D/g, "");

  let query = supabase.from("clients").select("id, full_name, phone").is("archived_at", null).limit(limit);
  if (term) {
    const filters = [`full_name.ilike.*${term}*`];
    if (digits.length >= 3) filters.push(`phone.ilike.*${digits}*`);
    query = query.or(filters.join(","));
  }
  const { data, error } = await query.order("full_name", { ascending: true });
  if (error) throw new Error("Não foi possível buscar clientes.");
  return data ?? [];
}

export type ProfessionalItem = { id: string; user_id: string; display_name: string };

/** Profissionais ativas do salão (a RLS já restringe ao salão da usuária). */
export async function listProfessionals(): Promise<ProfessionalItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professionals")
    .select("id, user_id, display_name")
    .eq("active", true)
    .order("display_name", { ascending: true });
  if (error) throw new Error("Não foi possível carregar as profissionais.");
  return data ?? [];
}

/**
 * Próximos atendimentos (aguardando confirmação ou confirmados) que ainda não terminaram,
 * do mais cedo ao mais tarde. Passa de hoje para os dias seguintes se hoje já acabou.
 */
export async function listUpcomingAppointments(now: Date, professionalId?: string, limit = 6): Promise<AppointmentItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .in("status", ["awaiting_confirmation", "confirmed"])
    .gte("end_at", now.toISOString())
    .order("start_at", { ascending: true })
    .limit(limit);
  if (professionalId) query = query.eq("professional_id", professionalId);
  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar os próximos atendimentos.");
  return (data ?? []) as unknown as AppointmentItem[];
}

/** Quantos atendimentos aguardam confirmação, de `from` em diante. */
export async function countPendingConfirmations(from: Date, professionalId?: string): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "awaiting_confirmation")
    .gte("start_at", from.toISOString());
  if (professionalId) query = query.eq("professional_id", professionalId);
  const { count, error } = await query;
  if (error) throw new Error("Não foi possível contar as confirmações pendentes.");
  return count ?? 0;
}
