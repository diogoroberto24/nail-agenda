import type { SupabaseClient } from "@supabase/supabase-js";
import { OCCUPYING_STATUSES } from "@/lib/appointments/conflicts";
import type { AppointmentStatus } from "@/lib/appointments/status";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OverlapRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  clients: { full_name: string } | null;
};

/** Atendimentos da mesma profissional que ocupam horário e cruzam o intervalo [start, end). */
export async function findOverlappingAppointments(
  supabase: SupabaseClient,
  professionalId: string,
  start: Date,
  end: Date,
  excludeId?: string,
): Promise<OverlapRow[]> {
  let query = supabase
    .from("appointments")
    .select("id, start_at, end_at, status, clients(full_name)")
    .eq("professional_id", professionalId)
    .in("status", [...OCCUPYING_STATUSES])
    .lt("start_at", end.toISOString())
    .gt("end_at", start.toISOString())
    .limit(10);
  if (excludeId && UUID.test(excludeId)) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw new Error("Não foi possível verificar conflitos de horário.");
  return (data ?? []) as unknown as OverlapRow[];
}
