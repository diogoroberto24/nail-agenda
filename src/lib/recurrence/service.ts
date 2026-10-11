/**
 * Recorrência de atendimentos: criar, repor, alterar e encerrar. Recebe o cliente Supabase da usuária logada
 * (a RLS continua valendo) e a profissional já autenticada; não depende do Next.js, então é testável contra o
 * banco real. A recorrência é uma regra PRIVADA da profissional; cada atendimento gerado é um atendimento comum,
 * ligado à série por (recurrence_id, occurrence_date), par único: gerar duas vezes nunca duplica.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { OCCUPYING_STATUSES } from "@/lib/appointments/conflicts";
import type { BusyInterval } from "@/lib/appointments/slots";
import { recurrenceSchema, toRecurrenceRow, toRule, type RecurrenceFormValues } from "@/lib/recurrence/schema";
import { horizonEnd, occurrenceDates, planOccurrences, type PlannedOccurrence, type RecurrenceRule } from "@/lib/recurrence/rules";
import { addDays, todayInZone, zonedDateTimeToUtc, zonedDayRange } from "@/lib/timezone";

export type Actor = { professionalId: string; salonId: string };

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHUNK = 100;

export type RecurrenceRow = {
  id: string;
  client_id: string;
  service_id: string;
  frequency: "weekly" | "monthly" | "every_days";
  interval_days: number | null;
  start_date: string;
  start_time: string;
  duration_minutes: number;
  price: number | string;
  notes: string | null;
  end_date: string | null;
  skipped_dates: string[];
  ended_at: string | null;
};

const RECURRENCE_COLUMNS =
  "id, client_id, service_id, frequency, interval_days, start_date, start_time, duration_minutes, price, notes, end_date, skipped_dates, ended_at";

const hhmm = (time: string) => time.slice(0, 5);

export function ruleOf(row: Pick<RecurrenceRow, "frequency" | "interval_days" | "start_date" | "end_date" | "skipped_dates">): RecurrenceRule {
  return { frequency: row.frequency, intervalDays: row.interval_days, startDate: row.start_date, endDate: row.end_date, skippedDates: row.skipped_dates ?? [] };
}

/** O serviço precisa ser da profissional e estar ativo; a cliente precisa existir e estar ativa. */
async function validateReferences(supabase: SupabaseClient, actor: Actor, clientId: string, serviceId: string): Promise<string | null> {
  const { data: service } = await supabase
    .from("services")
    .select("id, active")
    .eq("id", serviceId)
    .eq("professional_id", actor.professionalId)
    .maybeSingle();
  if (!service) return "Serviço não encontrado.";
  if (!service.active) return "Este serviço está desativado.";
  const { data: client } = await supabase.from("clients").select("id, archived_at").eq("id", clientId).maybeSingle();
  if (!client) return "Cliente não encontrada.";
  if (client.archived_at) return "Esta cliente está arquivada. Reative-a antes de criar a recorrência.";
  return null;
}

/** Intervalos ocupados da profissional em [from, to] (datas locais). `ignore` tira de cena a parte da série que será substituída. */
async function loadBusy(
  supabase: SupabaseClient,
  professionalId: string,
  from: string,
  to: string,
  ignore?: { recurrenceId: string; fromDate: string },
): Promise<BusyInterval[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("start_at, end_at, status, recurrence_id, occurrence_date")
    .eq("professional_id", professionalId)
    .in("status", [...OCCUPYING_STATUSES])
    .lt("start_at", zonedDayRange(to).end.toISOString())
    .gt("end_at", zonedDayRange(from).start.toISOString())
    .limit(2000);
  if (error) throw new Error("Não foi possível conferir a agenda.");
  return (data ?? [])
    .filter((a) => !(ignore && a.recurrence_id === ignore.recurrenceId && a.status === "awaiting_confirmation" && a.occurrence_date >= ignore.fromDate))
    .map((a) => ({ startAt: a.start_at as string, endAt: a.end_at as string }));
}

export type PreviewResult =
  | { ok: true; occurrences: PlannedOccurrence[]; conflicts: number }
  | { ok: false; error: string };

/** Mostra as datas que seriam criadas, com a marca de conflito, antes de qualquer gravação. */
export async function previewRecurrence(
  supabase: SupabaseClient,
  actor: Actor,
  values: unknown,
  opts: { today?: string; ignore?: { recurrenceId: string; fromDate: string } } = {},
): Promise<PreviewResult> {
  const parsed = recurrenceSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os campos e tente de novo." };
  const v = parsed.data;
  const today = opts.today ?? todayInZone();
  if (v.startDate < today) return { ok: false, error: "A data do primeiro atendimento não pode ser passada." };

  const refError = await validateReferences(supabase, actor, v.clientId, v.serviceId);
  if (refError) return { ok: false, error: refError };

  const until = horizonEnd(today);
  const rule = toRule(v);
  const range = { from: v.startDate, until };
  const dates = occurrenceDates(rule, range);
  if (dates.length === 0) return { ok: false, error: "Nenhum atendimento cabe nos próximos 6 meses com essas datas." };

  const busy = await loadBusy(supabase, actor.professionalId, dates[0], dates[dates.length - 1], opts.ignore);
  const occurrences = planOccurrences(rule, v.time, Number(v.durationMinutes), busy, range);
  return { ok: true, occurrences, conflicts: occurrences.filter((o) => o.conflict).length };
}

/** Insere as ocorrências que ainda não existem para a série; devolve quantas foram criadas. */
async function insertMissingOccurrences(
  supabase: SupabaseClient,
  actor: Actor,
  rec: Pick<RecurrenceRow, "id" | "client_id" | "service_id" | "start_time" | "duration_minutes" | "price" | "notes">,
  dates: string[],
): Promise<number> {
  if (dates.length === 0) return 0;
  let created = 0;
  // uma segunda passada cobre a corrida entre dois aparelhos: o que o outro criou no meio do caminho já existe
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: existing, error: readError } = await supabase.from("appointments").select("occurrence_date").eq("recurrence_id", rec.id).in("occurrence_date", dates);
    if (readError) throw new Error("Não foi possível conferir os atendimentos da recorrência.");
    const have = new Set((existing ?? []).map((e) => e.occurrence_date as string));
    const missing = dates.filter((d) => !have.has(d));
    if (missing.length === 0) return created;

    let raced = false;
    for (let i = 0; i < missing.length; i += CHUNK) {
      const rows = missing.slice(i, i + CHUNK).map((date) => {
        const start = zonedDateTimeToUtc(date, hhmm(rec.start_time));
        return {
          salon_id: actor.salonId,
          professional_id: actor.professionalId,
          client_id: rec.client_id,
          service_id: rec.service_id,
          start_at: start.toISOString(),
          end_at: new Date(start.getTime() + rec.duration_minutes * 60_000).toISOString(),
          duration_minutes_at_booking: rec.duration_minutes,
          price_at_booking: Number(rec.price),
          notes: rec.notes,
          recurrence_id: rec.id,
          occurrence_date: date,
        };
      });
      const { error } = await supabase.from("appointments").insert(rows);
      if (error) {
        if (error.code === "23505") {
          raced = true; // alguém criou alguma data ao mesmo tempo: refaz a conferência
          break;
        }
        throw new Error("Não foi possível criar os atendimentos da recorrência.");
      }
      created += rows.length;
    }
    if (!raced) return created;
  }
  return created;
}

export type CreateResult =
  | { ok: true; id: string; created: number }
  | { ok: false; error: string };

/**
 * Cria a recorrência e gera os atendimentos até 6 meses à frente (menos as datas puladas).
 * `id` vem do formulário: reenviar a mesma tentativa não cria uma segunda recorrência.
 */
export async function createRecurrence(
  supabase: SupabaseClient,
  actor: Actor,
  id: string,
  values: unknown,
  skippedDates: string[],
  today: string = todayInZone(),
): Promise<CreateResult> {
  if (!UUID.test(id)) return { ok: false, error: GENERIC_ERROR };
  const parsed = recurrenceSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Confira os campos e tente de novo." };
  const v = parsed.data;
  if (v.startDate < today) return { ok: false, error: "A data do primeiro atendimento não pode ser passada." };
  const skipped = [...new Set(skippedDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();

  const refError = await validateReferences(supabase, actor, v.clientId, v.serviceId);
  if (refError) return { ok: false, error: refError };

  const dates = occurrenceDates(toRule(v, skipped), { from: v.startDate, until: horizonEnd(today) });

  const { error } = await supabase
    .from("recurrences")
    .insert({ id, salon_id: actor.salonId, professional_id: actor.professionalId, ...toRecurrenceRow(v, skipped) });
  if (error && error.code !== "23505") return { ok: false, error: GENERIC_ERROR };
  if (error) {
    // mesma tentativa reenviada: só segue se a recorrência existir e for desta profissional
    const { data: mine } = await supabase.from("recurrences").select("id").eq("id", id).eq("professional_id", actor.professionalId).maybeSingle();
    if (!mine) return { ok: false, error: GENERIC_ERROR };
  }

  const { data: row } = await supabase.from("recurrences").select(RECURRENCE_COLUMNS).eq("id", id).single();
  try {
    const created = await insertMissingOccurrences(supabase, actor, row as RecurrenceRow, dates);
    return { ok: true, id, created };
  } catch {
    // não deixa uma recorrência "pela metade" ativa: encerra e avisa
    await supabase.from("recurrences").update({ ended_at: new Date().toISOString() }).eq("id", id);
    return { ok: false, error: GENERIC_ERROR };
  }
}

/**
 * Repõe, para cada recorrência ATIVA da profissional, os atendimentos que faltam até 6 meses à frente.
 * Roda quando ela abre o app; é idempotente. Datas puladas e dias cancelados não são recriados.
 */
export async function topUpRecurrences(supabase: SupabaseClient, actor: Actor, today: string = todayInZone()): Promise<{ created: number }> {
  const { data, error } = await supabase.from("recurrences").select(RECURRENCE_COLUMNS).eq("professional_id", actor.professionalId).is("ended_at", null);
  if (error) throw new Error("Não foi possível carregar as recorrências.");
  const until = horizonEnd(today);
  let created = 0;
  for (const row of (data ?? []) as RecurrenceRow[]) {
    const dates = occurrenceDates(ruleOf(row), { from: today, until });
    created += await insertMissingOccurrences(supabase, actor, row, dates);
  }
  return { created };
}

export type EndResult =
  | { ok: true; cancelled: number; kept: number }
  | { ok: false; error: string };

/**
 * Cancela, a partir de `fromDate`, os atendimentos da série que ainda aguardam confirmação e corta a regra.
 * Os já confirmados, concluídos ou com falta NÃO são tocados (`kept` diz quantos ficaram).
 */
async function cutSeries(supabase: SupabaseClient, actor: Actor, recurrenceId: string, fromDate: string): Promise<{ cancelled: number; kept: number } | null> {
  const { data: rec } = await supabase.from("recurrences").select("id, start_date, ended_at").eq("id", recurrenceId).eq("professional_id", actor.professionalId).maybeSingle();
  if (!rec || rec.ended_at) return null;

  const { data: cancelled, error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("recurrence_id", recurrenceId)
    .eq("professional_id", actor.professionalId)
    .eq("status", "awaiting_confirmation")
    .gte("occurrence_date", fromDate)
    .select("id");
  if (error) throw new Error("Não foi possível cancelar os atendimentos futuros.");

  const { count: kept } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("recurrence_id", recurrenceId)
    .gte("occurrence_date", fromDate)
    .in("status", ["confirmed", "completed", "no_show"]);

  // a regra acaba no dia anterior ao corte (ou fica sem data final se o corte é no primeiro dia)
  const lastDay = addDays(fromDate, -1);
  const patch = { ended_at: new Date().toISOString(), end_date: lastDay >= (rec.start_date as string) ? lastDay : null };
  const { error: upError } = await supabase.from("recurrences").update(patch).eq("id", recurrenceId).eq("professional_id", actor.professionalId);
  if (upError) throw new Error("Não foi possível encerrar a recorrência.");
  return { cancelled: cancelled?.length ?? 0, kept: kept ?? 0 };
}

/** Encerra a recorrência: cancela os futuros que ainda aguardam confirmação e para de gerar novos. */
export async function endRecurrence(supabase: SupabaseClient, actor: Actor, id: string, today: string = todayInZone()): Promise<EndResult> {
  if (!UUID.test(id)) return { ok: false, error: "Recorrência não encontrada." };
  try {
    const r = await cutSeries(supabase, actor, id, today);
    if (!r) return { ok: false, error: "Recorrência não encontrada ou já encerrada." };
    return { ok: true, ...r };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

export type ChangeResult =
  | { ok: true; id: string; created: number; cancelled: number; kept: number }
  | { ok: false; error: string };

/**
 * "Alterar a partir de uma data": encerra a série antiga nessa data (cancelando os futuros que aguardam
 * confirmação; os confirmados ficam) e cria uma série nova, começando em `values.startDate`.
 */
export async function changeRecurrenceFrom(
  supabase: SupabaseClient,
  actor: Actor,
  oldId: string,
  newId: string,
  values: unknown,
  skippedDates: string[],
  today: string = todayInZone(),
): Promise<ChangeResult> {
  if (!UUID.test(oldId) || !UUID.test(newId)) return { ok: false, error: "Recorrência não encontrada." };
  const parsed = recurrenceSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Confira os campos e tente de novo." };

  const { data: old } = await supabase.from("recurrences").select("id, client_id, ended_at").eq("id", oldId).eq("professional_id", actor.professionalId).maybeSingle();
  if (!old || old.ended_at) return { ok: false, error: "Recorrência não encontrada ou já encerrada." };
  if (old.client_id !== parsed.data.clientId) return { ok: false, error: "A recorrência é de outra cliente." };

  // primeiro valida e cria a nova (se algo estiver errado, a antiga não é tocada)... mas a nova só pode gerar
  // depois que a antiga liberar os horários; por isso a antiga é cortada logo antes da geração
  const fromDate = parsed.data.startDate;
  const refError = await validateReferences(supabase, actor, parsed.data.clientId, parsed.data.serviceId);
  if (refError) return { ok: false, error: refError };
  if (fromDate < today) return { ok: false, error: "A data do primeiro atendimento não pode ser passada." };

  try {
    const cut = await cutSeries(supabase, actor, oldId, fromDate);
    if (!cut) return { ok: false, error: "Recorrência não encontrada ou já encerrada." };
    const created = await createRecurrence(supabase, actor, newId, values, skippedDates, today);
    if (!created.ok) return { ok: false, error: created.error };
    return { ok: true, id: newId, created: created.created, cancelled: cut.cancelled, kept: cut.kept };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

export type { RecurrenceFormValues };
export { RECURRENCE_COLUMNS };
