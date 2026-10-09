/**
 * Regras de criação e edição de atendimentos. Recebe o cliente Supabase da usuária logada
 * (assim a RLS continua valendo) e a profissional já autenticada, e não depende do Next.js:
 * por isso pode ser testada contra o banco real.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { appointmentSchema, toAppointmentRow, toAppointmentTimes } from "@/lib/appointments/schema";
import { findOverlaps } from "@/lib/appointments/conflicts";
import { isAppointmentStatus, type AppointmentStatus } from "@/lib/appointments/status";
import { canTransition } from "@/lib/appointments/transitions";
import { findOverlappingAppointments, type OverlapRow } from "@/lib/appointments/queries";
import { formatTime, toZonedParts } from "@/lib/timezone";

export type ConflictInfo = { id: string; clientName: string; start: string; end: string };

export type SaveAppointmentResult =
  | { ok: true; id: string; date: string; statusReset?: boolean }
  | { ok: false; code: "conflict"; conflicts: ConflictInfo[] }
  | { ok: false; code: "error"; error: string };

export type Actor = { professionalId: string; salonId: string };

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toConflictInfo(rows: OverlapRow[]): ConflictInfo[] {
  return rows.map((r) => ({
    id: r.id,
    clientName: r.clients?.full_name ?? "cliente",
    start: formatTime(r.start_at),
    end: formatTime(r.end_at),
  }));
}

/** Conflitos de horário da profissional (só aviso; nunca bloqueia). */
export async function checkConflicts(
  supabase: SupabaseClient,
  actor: Actor,
  input: { date: string; time: string; durationMinutes: string; excludeId?: string },
): Promise<ConflictInfo[]> {
  const parsed = appointmentSchema.pick({ date: true, time: true, durationMinutes: true }).safeParse(input);
  if (!parsed.success) return [];
  const { start, end } = toAppointmentTimes(parsed.data);
  return toConflictInfo(await findOverlappingAppointments(supabase, actor.professionalId, start, end, input.excludeId));
}

/** O serviço precisa ser da profissional (e estar ativo); a cliente precisa existir (e estar ativa). */
async function validateReferences(
  supabase: SupabaseClient,
  actor: Actor,
  clientId: string,
  serviceId: string,
  keep?: { clientId: string; serviceId: string },
): Promise<string | null> {
  const { data: service } = await supabase
    .from("services")
    .select("id, active")
    .eq("id", serviceId)
    .eq("professional_id", actor.professionalId)
    .maybeSingle();
  if (!service) return "Serviço não encontrado.";
  if (!service.active && serviceId !== keep?.serviceId) return "Este serviço está desativado.";

  const { data: client } = await supabase.from("clients").select("id, archived_at").eq("id", clientId).maybeSingle();
  if (!client) return "Cliente não encontrada.";
  if (client.archived_at && clientId !== keep?.clientId) return "Esta cliente está arquivada. Reative-a antes de agendar.";
  return null;
}

/**
 * Cria um atendimento PARA A PROFISSIONAL LOGADA.
 * `id` vem do formulário: reenviar a mesma tentativa (toque repetido, conexão instável) não duplica.
 */
export async function createAppointment(
  supabase: SupabaseClient,
  actor: Actor,
  id: string,
  values: unknown,
  confirmConflict: boolean,
): Promise<SaveAppointmentResult> {
  if (!UUID.test(id)) return { ok: false, code: "error", error: GENERIC_ERROR };

  const parsed = appointmentSchema.safeParse(values);
  if (!parsed.success) return { ok: false, code: "error", error: "Confira os campos e tente de novo." };
  const row = toAppointmentRow(parsed.data);

  const refError = await validateReferences(supabase, actor, row.client_id, row.service_id);
  if (refError) return { ok: false, code: "error", error: refError };

  if (!confirmConflict) {
    const { start, end } = toAppointmentTimes(parsed.data);
    const overlaps = await findOverlappingAppointments(supabase, actor.professionalId, start, end);
    if (overlaps.length) return { ok: false, code: "conflict", conflicts: toConflictInfo(overlaps) };
  }

  const { error } = await supabase
    .from("appointments")
    .insert({ id, salon_id: actor.salonId, professional_id: actor.professionalId, ...row });

  if (error) {
    if (error.code === "23505") {
      // mesma tentativa reenviada: confirma que o atendimento existe e é desta profissional
      const { data: existing } = await supabase
        .from("appointments")
        .select("id")
        .eq("id", id)
        .eq("professional_id", actor.professionalId)
        .maybeSingle();
      if (existing) return { ok: true, id, date: parsed.data.date };
    }
    return { ok: false, code: "error", error: GENERIC_ERROR };
  }

  return { ok: true, id, date: parsed.data.date };
}

/**
 * Altera (ou remarca) um atendimento da própria profissional.
 * Regra: se o atendimento estava CONFIRMADO e a data ou o horário de início mudaram, ele volta para
 * "aguardando confirmação" (a cliente precisa confirmar o novo horário). Outras alterações não mexem no status.
 */
export async function updateAppointment(
  supabase: SupabaseClient,
  actor: Actor,
  id: string,
  values: unknown,
  confirmConflict: boolean,
): Promise<SaveAppointmentResult> {
  if (!UUID.test(id)) return { ok: false, code: "error", error: "Atendimento não encontrado." };

  const parsed = appointmentSchema.safeParse(values);
  if (!parsed.success) return { ok: false, code: "error", error: "Confira os campos e tente de novo." };
  const row = toAppointmentRow(parsed.data);

  const { data: current } = await supabase
    .from("appointments")
    .select("id, client_id, service_id, status, start_at")
    .eq("id", id)
    .eq("professional_id", actor.professionalId)
    .maybeSingle();
  if (!current) return { ok: false, code: "error", error: "Atendimento não encontrado." };
  if (current.status !== "awaiting_confirmation" && current.status !== "confirmed") {
    return { ok: false, code: "error", error: "Este atendimento não pode mais ser editado." };
  }

  const refError = await validateReferences(supabase, actor, row.client_id, row.service_id, {
    clientId: current.client_id,
    serviceId: current.service_id,
  });
  if (refError) return { ok: false, code: "error", error: refError };

  if (!confirmConflict) {
    const { start, end } = toAppointmentTimes(parsed.data);
    const overlaps = findOverlaps(
      start,
      end,
      await findOverlappingAppointments(supabase, actor.professionalId, start, end, id),
      id,
    );
    if (overlaps.length) return { ok: false, code: "conflict", conflicts: toConflictInfo(overlaps) };
  }

  const rescheduled = new Date(current.start_at).getTime() !== new Date(row.start_at).getTime();
  const statusReset = current.status === "confirmed" && rescheduled;

  const { data, error } = await supabase
    .from("appointments")
    .update(statusReset ? { ...row, status: "awaiting_confirmation" } : row)
    .eq("id", id)
    .eq("professional_id", actor.professionalId)
    .select("id");
  if (error) return { ok: false, code: "error", error: GENERIC_ERROR };
  if (!data?.length) return { ok: false, code: "error", error: "Atendimento não encontrado." };

  return { ok: true, id, date: toZonedParts(row.start_at).date, ...(statusReset ? { statusReset: true } : {}) };
}

export type SetStatusResult =
  | { ok: true; status: AppointmentStatus }
  | { ok: false; error: string };

/**
 * Muda o status de um atendimento da própria profissional (confirmar, concluir, não compareceu, cancelar).
 * Só aceita transições permitidas e só se o status ainda for o que a tela mostrava: se outro aparelho
 * já alterou, a mudança não é aplicada às cegas. Cancelar libera o horário (não exige motivo).
 */
export async function setAppointmentStatus(
  supabase: SupabaseClient,
  actor: Actor,
  id: string,
  next: AppointmentStatus,
  expectedCurrent?: AppointmentStatus,
): Promise<SetStatusResult> {
  if (!UUID.test(id) || !isAppointmentStatus(next)) return { ok: false, error: "Atendimento não encontrado." };

  const { data: current } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("id", id)
    .eq("professional_id", actor.professionalId)
    .maybeSingle();
  if (!current) return { ok: false, error: "Atendimento não encontrado." };

  const from = current.status as AppointmentStatus;
  if (expectedCurrent && from !== expectedCurrent) {
    return { ok: false, error: "Este atendimento já foi alterado em outro aparelho. A tela foi atualizada." };
  }
  if (!canTransition(from, next)) return { ok: false, error: "Esta mudança de status não é permitida." };

  // o filtro por status atual impede que duas mudanças simultâneas se sobreponham
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: next })
    .eq("id", id)
    .eq("professional_id", actor.professionalId)
    .eq("status", from)
    .select("id");
  if (error) return { ok: false, error: GENERIC_ERROR };
  if (!data?.length) return { ok: false, error: "Este atendimento já foi alterado em outro aparelho. A tela foi atualizada." };

  return { ok: true, status: next };
}
