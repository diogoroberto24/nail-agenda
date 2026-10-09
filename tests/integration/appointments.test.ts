import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { checkConflicts, createAppointment, updateAppointment, type Actor } from "@/lib/appointments/service";
import { toZonedParts, zonedDateTimeToUtc, zonedDayRange } from "@/lib/timezone";

/**
 * Regras de agendamento contra o Supabase REAL, usando as duas contas de teste do seed.
 * Usa datas em 2031 para não cruzar com atendimentos reais. Tudo que cria é apagado no final.
 */
const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL!;
const mk = (key: string) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = mk(env.SUPABASE_SECRET_KEY!);

const MARK = "__teste_agenda__";
const DAY = "2031-03-10";

type Session = { db: SupabaseClient; actor: Actor; userId: string };
let A: Session;
let B: Session;
let clientId: string;
let archivedClientId: string;
let svcA: string;
let svcAInactive: string;
let svcB: string;
const createdAppointments: string[] = [];

async function login(email: string, password: string): Promise<Session> {
  const db = mk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login falhou: ${error.message}`);
  const { data: pro, error: proErr } = await db
    .from("professionals")
    .select("id, salon_id")
    .eq("user_id", data.user.id)
    .single();
  if (proErr) throw new Error(proErr.message);
  return { db, userId: data.user.id, actor: { professionalId: pro.id, salonId: pro.salon_id } };
}

const values = (over: Record<string, string> = {}) => ({
  clientId,
  serviceId: svcA,
  date: DAY,
  time: "10:00",
  durationMinutes: "40",
  price: "50,00",
  notes: "",
  ...over,
});

async function create(s: Session, over: Record<string, string> = {}, confirm = false, id = randomUUID()) {
  const result = await createAppointment(s.db, s.actor, id, values(over), confirm);
  if (result.ok) createdAppointments.push(result.id);
  return { result, id };
}

/** Cria um atendimento de preparação e falha o teste se ele não foi gravado. */
async function setup(s: Session, over: Record<string, string> = {}, id = randomUUID()) {
  const r = await create(s, over, true, id);
  expect(r.result.ok, `preparação falhou: ${JSON.stringify(r.result)}`).toBe(true);
  return r.id;
}

async function countById(id: string) {
  const { count } = await admin.from("appointments").select("id", { count: "exact", head: true }).eq("id", id);
  return count ?? 0;
}

beforeAll(async () => {
  A = await login(env.SEED_PRO1_EMAIL!, env.SEED_PRO1_PASSWORD!);
  B = await login(env.SEED_PRO2_EMAIL!, env.SEED_PRO2_PASSWORD!);

  const cli = await A.db.from("clients").insert({ salon_id: A.actor.salonId, full_name: `${MARK} Cliente`, phone: "5511999991111" }).select("id").single();
  const arch = await A.db
    .from("clients")
    .insert({ salon_id: A.actor.salonId, full_name: `${MARK} Arquivada`, phone: "5511999992222", archived_at: new Date().toISOString() })
    .select("id")
    .single();
  clientId = cli.data!.id;
  archivedClientId = arch.data!.id;

  const mkSvc = async (s: Session, name: string, minutes: number, price: number, active = true) =>
    (
      await s.db
        .from("services")
        .insert({ salon_id: s.actor.salonId, professional_id: s.actor.professionalId, name: `${MARK} ${name}`, default_duration_minutes: minutes, default_price: price, active })
        .select("id")
        .single()
    ).data!.id as string;
  svcA = await mkSvc(A, "Esmaltação", 40, 50);
  svcAInactive = await mkSvc(A, "Desativado", 30, 20, false);
  svcB = await mkSvc(B, "Alongamento", 120, 180);
});

afterAll(async () => {
  if (createdAppointments.length) await admin.from("appointments").delete().in("id", createdAppointments);
  const { data: left } = await admin.from("clients").select("id").like("full_name", `${MARK}%`);
  const ids = (left ?? []).map((c) => c.id);
  if (ids.length) await admin.from("appointments").delete().in("client_id", ids);
  await admin.from("services").delete().like("name", `${MARK}%`);
  if (ids.length) await admin.from("clients").delete().in("id", ids);
});

describe("criar atendimento", () => {
  it("grava horário em UTC, copia duração e preço, status inicial e dono", async () => {
    const { result, id } = await create(A, { time: "09:00" });
    expect(result.ok).toBe(true);
    const { data } = await admin.from("appointments").select("*").eq("id", id).single();
    expect(data!.start_at).toBe("2031-03-10T12:00:00+00:00");
    expect(data!.end_at).toBe("2031-03-10T12:40:00+00:00");
    expect(data!.duration_minutes_at_booking).toBe(40);
    expect(Number(data!.price_at_booking)).toBe(50);
    expect(data!.status).toBe("awaiting_confirmation");
    expect(data!.professional_id).toBe(A.actor.professionalId);
    expect(data!.created_by).toBe(A.userId);
  });

  it("duração e preço editados valem só para este atendimento (o serviço não muda)", async () => {
    const { result, id } = await create(A, { time: "07:00", durationMinutes: "75", price: "65,50" });
    expect(result.ok).toBe(true);
    const { data } = await admin.from("appointments").select("duration_minutes_at_booking, price_at_booking, start_at, end_at").eq("id", id).single();
    expect(data!.duration_minutes_at_booking).toBe(75);
    expect(Number(data!.price_at_booking)).toBe(65.5);
    expect(new Date(data!.end_at).getTime() - new Date(data!.start_at).getTime()).toBe(75 * 60_000);
    const svc = await admin.from("services").select("default_duration_minutes, default_price").eq("id", svcA).single();
    expect(svc.data!.default_duration_minutes).toBe(40);
    expect(Number(svc.data!.default_price)).toBe(50);
  });

  it("sobreposição da mesma profissional: AVISA com nome e horário, não grava; confirmando, grava", async () => {
    const { result: first } = await create(A, { time: "14:00" });
    expect(first.ok).toBe(true);

    const attempt = await create(A, { time: "14:20" });
    expect(attempt.result.ok).toBe(false);
    if (!attempt.result.ok && attempt.result.code === "conflict") {
      expect(attempt.result.conflicts[0]).toMatchObject({ clientName: `${MARK} Cliente`, start: "14:00", end: "14:40" });
    } else {
      throw new Error("esperava conflito");
    }
    expect(await countById(attempt.id)).toBe(0);

    const confirmed = await create(A, { time: "14:20" }, true);
    expect(confirmed.result.ok).toBe(true);
    expect(await countById(confirmed.id)).toBe(1);
  });

  it("atendimentos consecutivos (fim = início) não geram aviso", async () => {
    await create(A, { time: "16:00" }); // 16:00–16:40
    const next = await create(A, { time: "16:40" });
    expect(next.result.ok).toBe(true);
    const before = await create(A, { time: "15:20" }); // 15:20–16:00
    expect(before.result.ok).toBe(true);
  });

  it("profissionais diferentes no mesmo horário: sem aviso e sem bloqueio", async () => {
    await create(A, { time: "11:00" });
    const other = await create(B, { time: "11:00", serviceId: svcB, durationMinutes: "120", price: "180" });
    expect(other.result.ok).toBe(true);
  });

  it("reenvio da mesma tentativa não duplica (toque repetido / conexão instável)", async () => {
    const id = randomUUID();
    const one = await create(A, { time: "12:30" }, false, id);
    const two = await create(A, { time: "12:30" }, true, id);
    expect(one.result.ok).toBe(true);
    expect(two.result.ok).toBe(true);
    expect(await countById(id)).toBe(1);
  });

  it("outra profissional não consegue 'reaproveitar' o id de um atendimento alheio", async () => {
    const id = randomUUID();
    await setup(A, { time: "12:00" }, id);
    const hijack = await createAppointment(B.db, B.actor, id, values({ serviceId: svcB, time: "12:00", durationMinutes: "120", price: "180" }), true);
    expect(hijack.ok).toBe(false);
  });

  it("recusa serviço de outra profissional, serviço desativado e cliente arquivada", async () => {
    const wrongService = await create(A, { serviceId: svcB, time: "08:00" });
    expect(wrongService.result).toMatchObject({ ok: false, error: "Serviço não encontrado." });
    const inactive = await create(A, { serviceId: svcAInactive, time: "08:00" });
    expect(inactive.result).toMatchObject({ ok: false, error: "Este serviço está desativado." });
    const archived = await create(A, { clientId: archivedClientId, time: "08:00" });
    expect(archived.result).toMatchObject({ ok: false });
    expect(await countById(wrongService.id)).toBe(0);
  });

  it("recusa dados inválidos no servidor", async () => {
    const r = await create(A, { time: "25:00" });
    expect(r.result).toMatchObject({ ok: false, code: "error" });
    const r2 = await create(A, { durationMinutes: "0" });
    expect(r2.result).toMatchObject({ ok: false, code: "error" });
  });

  it("cancelado e 'não compareceu' liberam o horário", async () => {
    const first = await create(A, { time: "18:00" });
    expect(first.result.ok).toBe(true);
    await A.db.from("appointments").update({ status: "cancelled" }).eq("id", first.id);
    const afterCancel = await create(A, { time: "18:10" });
    expect(afterCancel.result.ok).toBe(true);
    await A.db.from("appointments").update({ status: "no_show" }).eq("id", afterCancel.id);
    const afterNoShow = await create(A, { time: "18:20" });
    expect(afterNoShow.result.ok).toBe(true);
  });

  it("checkConflicts reproduz o aviso em tempo real", async () => {
    await create(A, { time: "19:00" });
    const found = await checkConflicts(A.db, A.actor, { date: DAY, time: "19:10", durationMinutes: "30" });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ start: "19:00", end: "19:40" });
    expect(await checkConflicts(A.db, A.actor, { date: DAY, time: "19:40", durationMinutes: "30" })).toHaveLength(0);
    expect(await checkConflicts(A.db, A.actor, { date: "lixo", time: "x", durationMinutes: "y" })).toEqual([]);
  });
});

describe("editar e remarcar", () => {
  it("editar sem mudar o horário não conflita consigo mesmo", async () => {
    const id = await setup(A, { time: "20:00" });
    const r = await updateAppointment(A.db, A.actor, id, values({ time: "20:00", notes: "trocou observação" }), false);
    expect(r.ok).toBe(true);
    const { data } = await admin.from("appointments").select("notes").eq("id", id).single();
    expect(data!.notes).toBe("trocou observação");
  });

  it("remarcar muda data/horário; mover sobre outro atendimento avisa", async () => {
    const a1 = await setup(A, { time: "21:00" });
    const a2 = await setup(A, { time: "22:00" });
    await setup(A, { time: "23:00" });

    const moved = await updateAppointment(A.db, A.actor, a1, values({ date: "2031-03-11", time: "09:30" }), false);
    expect(moved).toMatchObject({ ok: true, date: "2031-03-11" });
    const { data } = await admin.from("appointments").select("start_at").eq("id", a1).single();
    expect(toZonedParts(data!.start_at)).toEqual({ date: "2031-03-11", time: "09:30" });

    const conflict = await updateAppointment(A.db, A.actor, a2, values({ time: "22:50" }), false);
    expect(conflict.ok).toBe(false);
    expect(conflict).toMatchObject({ code: "conflict" });
    const confirmed = await updateAppointment(A.db, A.actor, a2, values({ time: "22:50" }), true);
    expect(confirmed.ok).toBe(true);
  });

  it("remarcar um atendimento CONFIRMADO o devolve para aguardando confirmação", async () => {
    const dateChange = await setup(A, { date: "2031-06-01", time: "08:00" });
    await A.db.from("appointments").update({ status: "confirmed" }).eq("id", dateChange);
    const r1 = await updateAppointment(A.db, A.actor, dateChange, values({ date: "2031-06-02", time: "08:00" }), true);
    expect(r1).toMatchObject({ ok: true, statusReset: true });
    expect((await admin.from("appointments").select("status").eq("id", dateChange).single()).data!.status).toBe("awaiting_confirmation");

    const timeChange = await setup(A, { date: "2031-06-03", time: "08:00" });
    await A.db.from("appointments").update({ status: "confirmed" }).eq("id", timeChange);
    const r2 = await updateAppointment(A.db, A.actor, timeChange, values({ date: "2031-06-03", time: "09:00" }), true);
    expect(r2).toMatchObject({ ok: true, statusReset: true });
    expect((await admin.from("appointments").select("status").eq("id", timeChange).single()).data!.status).toBe("awaiting_confirmation");
  });

  it("alterar só observação, preço ou duração de um confirmado NÃO muda o status", async () => {
    const id = await setup(A, { date: "2031-06-04", time: "08:00" });
    await A.db.from("appointments").update({ status: "confirmed" }).eq("id", id);
    const r = await updateAppointment(A.db, A.actor, id, values({ date: "2031-06-04", time: "08:00", notes: "só obs", price: "70", durationMinutes: "50" }), true);
    expect(r.ok).toBe(true);
    expect(r).not.toHaveProperty("statusReset");
    const { data } = await admin.from("appointments").select("status, notes, duration_minutes_at_booking").eq("id", id).single();
    expect(data).toMatchObject({ status: "confirmed", notes: "só obs", duration_minutes_at_booking: 50 });
  });

  it("remarcar um atendimento que já aguarda confirmação continua aguardando (sem aviso de reset)", async () => {
    const id = await setup(A, { date: "2031-06-05", time: "08:00" });
    const r = await updateAppointment(A.db, A.actor, id, values({ date: "2031-06-05", time: "09:00" }), true);
    expect(r.ok).toBe(true);
    expect(r).not.toHaveProperty("statusReset");
    expect((await admin.from("appointments").select("status").eq("id", id).single()).data!.status).toBe("awaiting_confirmation");
  });

  it("a colega não consegue editar o atendimento (nem existe para ela como editável)", async () => {
    const id = await setup(A, { time: "06:00" });
    const r = await updateAppointment(B.db, B.actor, id, values({ serviceId: svcB, time: "06:30" }), true);
    expect(r).toMatchObject({ ok: false, error: "Atendimento não encontrado." });
    const { data } = await admin.from("appointments").select("start_at").eq("id", id).single();
    expect(toZonedParts(data!.start_at).time).toBe("06:00");
  });

  it("atendimento concluído, cancelado ou com falta não pode mais ser editado", async () => {
    for (const status of ["completed", "cancelled", "no_show"]) {
      const id = await setup(A, { time: "05:00" });
      await A.db.from("appointments").update({ status }).eq("id", id);
      const r = await updateAppointment(A.db, A.actor, id, values({ time: "05:30" }), true);
      expect(r).toMatchObject({ ok: false, error: "Este atendimento não pode mais ser editado." });
    }
  });

  it("serviço desativado depois continua válido no atendimento já existente, mas não em novo serviço", async () => {
    const svc = (
      await A.db
        .from("services")
        .insert({ salon_id: A.actor.salonId, professional_id: A.actor.professionalId, name: `${MARK} Temporário`, default_duration_minutes: 30, default_price: 10 })
        .select("id")
        .single()
    ).data!.id as string;
    const { id } = await create(A, { serviceId: svc, time: "04:00", durationMinutes: "30", price: "10" });
    await A.db.from("services").update({ active: false }).eq("id", svc);
    const keep = await updateAppointment(A.db, A.actor, id, values({ serviceId: svc, time: "04:10", durationMinutes: "30", price: "10" }), true);
    expect(keep.ok).toBe(true);
    const other = (await create(A, { time: "03:00" })).id;
    const change = await updateAppointment(A.db, A.actor, other, values({ serviceId: svc, time: "03:00" }), true);
    expect(change).toMatchObject({ ok: false, error: "Este serviço está desativado." });
  });
});

describe("agenda do dia no fuso do salão", () => {
  it("23:30 pertence ao dia; 00:00 do dia seguinte não; cancelado fica fora da lista", async () => {
    const late = await create(A, { date: "2031-04-01", time: "23:30", durationMinutes: "30" });
    const midnight = await create(A, { date: "2031-04-02", time: "00:00", durationMinutes: "30" });
    const cancelled = await create(A, { date: "2031-04-01", time: "08:00" });
    await A.db.from("appointments").update({ status: "cancelled" }).eq("id", cancelled.id);

    const { start, end } = zonedDayRange("2031-04-01");
    const { data } = await A.db
      .from("appointments")
      .select("id")
      .gte("start_at", start.toISOString())
      .lt("start_at", end.toISOString())
      .neq("status", "cancelled");
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(late.id);
    expect(ids).not.toContain(midnight.id);
    expect(ids).not.toContain(cancelled.id);
    expect(zonedDateTimeToUtc("2031-04-01", "23:30").toISOString()).toBe("2031-04-02T02:30:00.000Z");
  });

  it("a colega enxerga o atendimento (agenda compartilhada) mas não o altera", async () => {
    const id = await setup(A, { time: "02:00" });
    const seen = await B.db.from("appointments").select("id, clients(full_name), services(name), professionals(display_name)").eq("id", id).single();
    expect(seen.error).toBeNull();
    expect((seen.data as unknown as { professionals: { display_name: string } }).professionals.display_name).toBeTruthy();
    const edit = await B.db.from("appointments").update({ notes: "x" }).eq("id", id).select("id");
    expect(edit.data ?? []).toHaveLength(0);
  });
});

describe("operações simultâneas dos dois celulares", () => {
  it("as duas marcam ao mesmo tempo no mesmo horário: ambas conseguem", async () => {
    const [a, b] = await Promise.all([
      create(A, { date: "2031-05-05", time: "10:00" }),
      create(B, { date: "2031-05-05", time: "10:00", serviceId: svcB, durationMinutes: "120", price: "180" }),
    ]);
    expect(a.result.ok).toBe(true);
    expect(b.result.ok).toBe(true);
  });

  it("dois envios simultâneos da mesma tentativa resultam em um único atendimento", async () => {
    const id = randomUUID();
    const [x, y] = await Promise.all([
      create(A, { date: "2031-05-06", time: "10:00" }, true, id),
      create(A, { date: "2031-05-06", time: "10:00" }, true, id),
    ]);
    expect(x.result.ok).toBe(true);
    expect(y.result.ok).toBe(true);
    expect(await countById(id)).toBe(1);
  });
});
