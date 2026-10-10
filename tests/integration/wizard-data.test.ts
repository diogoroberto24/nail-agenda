import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { pickRecentClients, type RecentClientRow } from "@/lib/appointments/recent-clients";

/**
 * "Clientes recentes" (etapa 1 do novo agendamento) contra o Supabase REAL.
 * Usa a mesma consulta de src/lib/data/appointments.ts (listRecentClients).
 */
const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL!;
const mk = (key: string) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = mk(env.SUPABASE_SECRET_KEY!);

const MARK = "__teste_recentes__";
let A: { db: SupabaseClient; proId: string; userId: string };
let proB: string;
let salonId: string;
let serviceA: string;
let serviceB: string;
const ids: Record<string, string> = {};

async function recentFor(db: SupabaseClient, professionalId: string, limit = 4) {
  const { data, error } = await db
    .from("appointments")
    .select("client_id, clients(id, full_name, phone, archived_at)")
    .eq("professional_id", professionalId)
    .order("created_at", { ascending: false })
    .limit(80);
  expect(error).toBeNull();
  return pickRecentClients((data ?? []) as unknown as RecentClientRow[], limit);
}

async function book(clientId: string, professionalId: string, serviceId: string, day: string) {
  const start = new Date(`${day}T13:00:00Z`);
  const { error } = await admin.from("appointments").insert({
    salon_id: salonId, professional_id: professionalId, client_id: clientId, service_id: serviceId,
    start_at: start.toISOString(), end_at: new Date(start.getTime() + 30 * 60000).toISOString(),
    duration_minutes_at_booking: 30, price_at_booking: 10, created_by: A.userId,
  });
  expect(error).toBeNull();
  await new Promise((r) => setTimeout(r, 30)); // created_at diferente em cada marcação
}

beforeAll(async () => {
  const db = mk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { data, error } = await db.auth.signInWithPassword({ email: env.SEED_PRO1_EMAIL!, password: env.SEED_PRO1_PASSWORD! });
  if (error) throw new Error(error.message);
  const pros = (await admin.from("professionals").select("id, salon_id, user_id")).data!;
  const mine = pros.find((p) => p.user_id === data.user.id)!;
  proB = pros.find((p) => p.user_id !== data.user.id)!.id;
  salonId = mine.salon_id;
  A = { db, proId: mine.id, userId: data.user.id };

  const mkClient = async (name: string, phone: string, archived = false) =>
    (await admin.from("clients").insert({ salon_id: salonId, full_name: `${MARK} ${name}`, phone, archived_at: archived ? new Date().toISOString() : null }).select("id").single()).data!.id as string;
  for (const [key, name, phone, archived] of [
    ["ana", "Ana", "5511955550001", false],
    ["bia", "Bia", "5511955550002", false],
    ["carla", "Carla", "5511955550003", false],
    ["dani", "Dani (arquivada)", "5511955550004", true],
    ["eva", "Eva (só da colega)", "5511955550005", false],
  ] as const) ids[key] = await mkClient(name, phone, archived);

  const mkService = async (professionalId: string, name: string) =>
    (await admin.from("services").insert({ salon_id: salonId, professional_id: professionalId, name: `${MARK} ${name}`, default_duration_minutes: 30, default_price: 10 }).select("id").single()).data!.id as string;
  serviceA = await mkService(mine.id, "Serviço A");
  serviceB = await mkService(proB, "Serviço B");

  // ordem das marcações feitas por A: ana, bia, ana (de novo), dani (arquivada), carla
  await book(ids.ana, mine.id, serviceA, "2031-11-01");
  await book(ids.bia, mine.id, serviceA, "2031-11-02");
  await book(ids.ana, mine.id, serviceA, "2031-11-03");
  await book(ids.dani, mine.id, serviceA, "2031-11-04");
  await book(ids.carla, mine.id, serviceA, "2031-11-05");
  await book(ids.eva, proB, serviceB, "2031-11-06"); // marcação da colega
});

afterAll(async () => {
  const { data: cs } = await admin.from("clients").select("id").like("full_name", `${MARK}%`);
  const clientIds = (cs ?? []).map((c) => c.id);
  if (clientIds.length) await admin.from("appointments").delete().in("client_id", clientIds);
  await admin.from("services").delete().like("name", `${MARK}%`);
  if (clientIds.length) await admin.from("clients").delete().in("id", clientIds);
});

describe("clientes recentes no banco real", () => {
  it("as últimas agendadas por MIM, da mais recente para a mais antiga, sem repetir e sem arquivadas", async () => {
    const recent = await recentFor(A.db, A.proId, 10);
    const mine = recent.filter((c) => c.fullName.startsWith(MARK)).map((c) => c.fullName.replace(`${MARK} `, ""));
    // Carla (última marcação), Ana (marcou duas vezes: conta uma, na posição da mais recente), Bia; sem Dani (arquivada)
    expect(mine).toEqual(["Carla", "Ana", "Bia"]);
  });

  it("clientes que só a colega atendeu não aparecem nas minhas recentes", async () => {
    const recent = await recentFor(A.db, A.proId, 10);
    expect(recent.some((c) => c.fullName.includes("Eva"))).toBe(false);
    const hers = await recentFor(A.db, proB, 10);
    expect(hers.map((c) => c.fullName.replace(`${MARK} `, "")).filter((n) => n.startsWith("Eva"))).toEqual(["Eva (só da colega)"]);
  });

  it("o limite é respeitado e as relações (nome e telefone) vêm junto", async () => {
    const two = await recentFor(A.db, A.proId, 2);
    expect(two).toHaveLength(2);
    expect(two[0]).toMatchObject({ phone: expect.stringMatching(/^55\d{10,11}$/) });
    expect(two[0].fullName.length).toBeGreaterThan(0);
  });
});

/** Mesma consulta de listBusyIntervals (src/lib/data/appointments.ts). */
async function busyFor(db: SupabaseClient, professionalId: string, from: string, to: string) {
  const { data, error } = await db
    .from("appointments")
    .select("start_at, end_at")
    .eq("professional_id", professionalId)
    .in("status", ["awaiting_confirmation", "confirmed", "completed"])
    .lt("start_at", to)
    .gt("end_at", from)
    .order("start_at", { ascending: true });
  expect(error).toBeNull();
  return (data ?? []).map((r) => r.start_at as string);
}

describe("horários ocupados no banco real (etapa Data e horário)", () => {
  it("devolve só os atendimentos da PRÓPRIA profissional no período, e não os da colega", async () => {
    const mine = await busyFor(A.db, A.proId, "2031-11-01T00:00:00Z", "2031-11-08T00:00:00Z");
    expect(mine).toHaveLength(5); // Ana, Bia, Ana, Dani, Carla (a da colega, em 06/11, fica de fora)
    const hers = await busyFor(A.db, proB, "2031-11-01T00:00:00Z", "2031-11-08T00:00:00Z");
    expect(hers).toHaveLength(1);
  });

  it("respeita os limites do período (meio aberto)", async () => {
    expect(await busyFor(A.db, A.proId, "2031-11-02T00:00:00Z", "2031-11-03T00:00:00Z")).toHaveLength(1);
    // fim do atendimento (13:30) igual ao início do período não conta
    expect(await busyFor(A.db, A.proId, "2031-11-01T13:30:00Z", "2031-11-01T14:00:00Z")).toHaveLength(0);
    expect(await busyFor(A.db, A.proId, "2031-11-01T13:29:00Z", "2031-11-01T14:00:00Z")).toHaveLength(1);
  });

  it("cancelado e falta liberam o horário", async () => {
    await admin.from("appointments").update({ status: "cancelled" }).eq("professional_id", A.proId).gte("start_at", "2031-11-02T00:00:00Z").lt("start_at", "2031-11-03T00:00:00Z");
    expect(await busyFor(A.db, A.proId, "2031-11-02T00:00:00Z", "2031-11-03T00:00:00Z")).toHaveLength(0);
    await admin.from("appointments").update({ status: "no_show" }).eq("professional_id", A.proId).gte("start_at", "2031-11-03T00:00:00Z").lt("start_at", "2031-11-04T00:00:00Z");
    expect(await busyFor(A.db, A.proId, "2031-11-03T00:00:00Z", "2031-11-04T00:00:00Z")).toHaveLength(0);
  });
});
