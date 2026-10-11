import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { limitRecurrencesToWeek, weekEndUtc } from "@/lib/appointments/home-week";
import { createRecurrence, type Actor } from "@/lib/recurrence/service";
import { createAppointment } from "@/lib/appointments/service";

/**
 * Tela Início: atendimentos de recorrência só da semana atual, contra o Supabase REAL (migração 20261012000001).
 * As consultas abaixo usam o mesmo filtro de src/lib/data/appointments.ts (limitRecurrencesToWeek).
 * "Hoje" é fixo (quarta 2031-01-01), então a semana atual é 2030-12-30 a 2031-01-05.
 */
const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL!;
const mk = (key: string) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = mk(env.SUPABASE_SECRET_KEY!);

const MARK = "__teste_inicio_semana__";
const TODAY = "2031-01-01";
const NOW = new Date("2031-01-01T12:00:00Z"); // 09:00 em São Paulo
const WEEK_END = weekEndUtc(TODAY); // segunda 2031-01-06 00:00 (São Paulo)

let db: SupabaseClient;
let actor: Actor;
let clientId: string;
let serviceId: string;
let avulsoNextMonthId: string;

async function upcoming(withLimit: boolean) {
  let q = db
    .from("appointments")
    .select("id, start_at, recurrence_id, client_id")
    .in("status", ["awaiting_confirmation", "confirmed"])
    .gte("end_at", NOW.toISOString())
    .eq("client_id", clientId)
    .order("start_at", { ascending: true })
    .limit(200);
  if (withLimit) q = limitRecurrencesToWeek(q, WEEK_END);
  const { data, error } = await q;
  expect(error).toBeNull();
  return data ?? [];
}

async function pending(withLimit: boolean) {
  let q = db.from("appointments").select("id", { count: "exact", head: true }).eq("status", "awaiting_confirmation").eq("client_id", clientId).gte("start_at", NOW.toISOString());
  if (withLimit) q = limitRecurrencesToWeek(q, WEEK_END);
  const { count, error } = await q;
  expect(error).toBeNull();
  return count ?? 0;
}

beforeAll(async () => {
  db = mk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { data, error } = await db.auth.signInWithPassword({ email: env.SEED_PRO1_EMAIL!, password: env.SEED_PRO1_PASSWORD! });
  if (error) throw new Error(error.message);
  const pro = (await db.from("professionals").select("id, salon_id").eq("user_id", data.user.id).single()).data!;
  actor = { professionalId: pro.id, salonId: pro.salon_id };
  clientId = (await db.from("clients").insert({ salon_id: actor.salonId, full_name: `${MARK} Cliente`, phone: "5511955551111" }).select("id").single()).data!.id;
  serviceId = (await db.from("services").insert({ salon_id: actor.salonId, professional_id: actor.professionalId, name: `${MARK} Serviço`, default_duration_minutes: 40, default_price: 50 }).select("id").single()).data!.id;

  // recorrência semanal às quartas, 10:00, a partir de hoje (quarta 01/01/2031): 6 meses de atendimentos
  const rec = await createRecurrence(db, actor, randomUUID(), { clientId, serviceId, frequency: "weekly", intervalDays: "", startDate: "2031-01-01", time: "10:00", durationMinutes: "40", price: "50,00", notes: "", endDate: "" }, [], TODAY);
  expect(rec.ok).toBe(true);

  // dois atendimentos AVULSOS: um nesta semana (sexta 03/01) e um daqui a um mês (05/02), que devem continuar aparecendo
  const mk1 = await createAppointment(db, actor, randomUUID(), { clientId, serviceId, date: "2031-01-03", time: "15:00", durationMinutes: "40", price: "50,00", notes: "" }, true);
  const mk2 = await createAppointment(db, actor, randomUUID(), { clientId, serviceId, date: "2031-02-05", time: "15:00", durationMinutes: "40", price: "50,00", notes: "" }, true);
  expect(mk1.ok && mk2.ok).toBe(true);
  if (mk2.ok) avulsoNextMonthId = mk2.id;
});

afterAll(async () => {
  const { data: recs } = await admin.from("recurrences").select("id").eq("client_id", clientId);
  const ids = (recs ?? []).map((r) => r.id);
  await admin.from("appointments").delete().eq("client_id", clientId);
  if (ids.length) await admin.from("recurrences").delete().in("id", ids);
  await admin.from("services").delete().like("name", `${MARK}%`);
  await admin.from("clients").delete().like("full_name", `${MARK}%`);
});

describe("Início: recorrência só da semana atual", () => {
  it("sem o filtro, os 6 meses da recorrência enchem a lista (o problema)", async () => {
    const all = await upcoming(false);
    expect(all.filter((a) => a.recurrence_id).length).toBeGreaterThan(20);
  });

  it("com o filtro, a recorrência só aparece se começar antes do fim da semana", async () => {
    const list = await upcoming(true);
    const recurring = list.filter((a) => a.recurrence_id);
    expect(recurring).toHaveLength(1); // só a de hoje, quarta 01/01 às 10:00
    expect(new Date(recurring[0].start_at).getTime()).toBeLessThan(WEEK_END.getTime());
    expect(recurring[0].start_at).toBe("2031-01-01T13:00:00+00:00");
  });

  it("atendimentos avulsos continuam todos aparecendo, mesmo os de semanas ou meses à frente", async () => {
    const list = await upcoming(true);
    const avulsos = list.filter((a) => !a.recurrence_id);
    expect(avulsos).toHaveLength(2);
    expect(avulsos.some((a) => a.id === avulsoNextMonthId)).toBe(true);
  });

  it("a ordem continua do mais cedo para o mais tarde", async () => {
    const list = await upcoming(true);
    expect(list.map((a) => a.start_at)).toEqual([...list.map((a) => a.start_at)].sort());
  });

  it("o contador de confirmações pendentes também só conta a recorrência da semana", async () => {
    const semFiltro = await pending(false);
    const comFiltro = await pending(true);
    expect(semFiltro).toBeGreaterThan(20);
    expect(comFiltro).toBe(3); // recorrência de hoje + 2 avulsos (todos aguardando confirmação)
  });

  it("a recorrência da semana seguinte só entra quando a semana virar", async () => {
    // segunda 2031-01-06 em diante já é a semana seguinte: a quarta 08/01 passa a valer
    const nextWeekEnd = weekEndUtc("2031-01-06");
    const { data } = await db
      .from("appointments")
      .select("id, start_at, recurrence_id")
      .eq("client_id", clientId)
      .in("status", ["awaiting_confirmation", "confirmed"])
      .gte("end_at", "2031-01-06T03:00:00Z")
      .not("recurrence_id", "is", null)
      .or(`recurrence_id.is.null,start_at.lt.${nextWeekEnd.toISOString()}`)
      .order("start_at", { ascending: true });
    expect((data ?? []).map((a) => a.start_at.slice(0, 10))).toEqual(["2031-01-08"]);
  });
});
