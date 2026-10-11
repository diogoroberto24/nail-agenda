import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { changeRecurrenceFrom, createRecurrence, endRecurrence, previewRecurrence, topUpRecurrences, type Actor } from "@/lib/recurrence/service";
import { createAppointment, setAppointmentStatus } from "@/lib/appointments/service";
import { horizonEnd } from "@/lib/recurrence/rules";
import { toZonedParts } from "@/lib/timezone";

/**
 * Recorrência contra o Supabase REAL (exige a migração 20261012000001 aplicada), com as duas contas de teste.
 * "Hoje" é fixo (2031-01-01) para o teste não depender do dia em que roda e não cruzar com atendimentos reais.
 */
const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL!;
const mk = (key: string) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = mk(env.SUPABASE_SECRET_KEY!);

const MARK = "__teste_recorrencia__";
const TODAY = "2031-01-01"; // quarta-feira
const HORIZON = horizonEnd(TODAY); // 2031-07-01

type Session = { db: SupabaseClient; actor: Actor; userId: string };
let A: Session;
let B: Session;
let clientId: string;
let svcA: string;
let svcB: string;

async function login(email: string, password: string): Promise<Session> {
  const db = mk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login falhou: ${error.message}`);
  const { data: pro } = await db.from("professionals").select("id, salon_id").eq("user_id", data.user.id).single();
  return { db, userId: data.user.id, actor: { professionalId: pro!.id, salonId: pro!.salon_id } };
}

const values = (over: Record<string, string> = {}) => ({
  clientId,
  serviceId: svcA,
  frequency: "weekly",
  intervalDays: "",
  startDate: "2031-01-07", // terça-feira
  time: "10:00",
  durationMinutes: "40",
  price: "50,00",
  notes: "",
  endDate: "",
  ...over,
});

const mkId = () => randomUUID();

async function occurrencesOf(recId: string, status?: string) {
  let q = admin.from("appointments").select("id, occurrence_date, start_at, status, price_at_booking, duration_minutes_at_booking, professional_id").eq("recurrence_id", recId).order("occurrence_date");
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return data ?? [];
}

beforeAll(async () => {
  A = await login(env.SEED_PRO1_EMAIL!, env.SEED_PRO1_PASSWORD!);
  B = await login(env.SEED_PRO2_EMAIL!, env.SEED_PRO2_PASSWORD!);
  const cli = await A.db.from("clients").insert({ salon_id: A.actor.salonId, full_name: `${MARK} Cliente`, phone: "5511966661111" }).select("id").single();
  clientId = cli.data!.id;
  const mkSvc = async (s: Session, name: string) =>
    (await s.db.from("services").insert({ salon_id: s.actor.salonId, professional_id: s.actor.professionalId, name: `${MARK} ${name}`, default_duration_minutes: 40, default_price: 50 }).select("id").single()).data!.id as string;
  svcA = await mkSvc(A, "Serviço A");
  svcB = await mkSvc(B, "Serviço B");
});

afterAll(async () => {
  const { data: recs } = await admin.from("recurrences").select("id").eq("client_id", clientId);
  const ids = (recs ?? []).map((r) => r.id);
  if (ids.length) await admin.from("appointments").delete().in("recurrence_id", ids);
  await admin.from("appointments").delete().eq("client_id", clientId);
  if (ids.length) await admin.from("recurrences").delete().in("id", ids);
  await admin.from("services").delete().like("name", `${MARK}%`);
  await admin.from("clients").delete().like("full_name", `${MARK}%`);
});

describe("criar", () => {
  it("semanal: gera os atendimentos de 7 em 7 dias até 6 meses, como aguardando confirmação, com duração e preço da regra", async () => {
    const r = await createRecurrence(A.db, A.actor, mkId(), values(), [], TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const occ = await occurrencesOf(r.id);
    expect(occ.length).toBe(r.created);
    expect(occ[0].occurrence_date).toBe("2031-01-07");
    expect(occ.at(-1)!.occurrence_date <= HORIZON).toBe(true);
    expect(occ.length).toBe(26); // 07/01 a 01/07/2031 (o horizonte é inclusivo), de 7 em 7 dias
    expect(occ.every((o) => o.status === "awaiting_confirmation" && o.professional_id === A.actor.professionalId)).toBe(true);
    expect(occ.every((o) => Number(o.price_at_booking) === 50 && o.duration_minutes_at_booking === 40)).toBe(true);
    // horário local 10:00 (UTC-3) em todas as datas
    expect(occ.every((o) => toZonedParts(o.start_at).time === "10:00" && toZonedParts(o.start_at).date === o.occurrence_date)).toBe(true);
  });

  it("mensal no dia 31 usa o último dia dos meses curtos", async () => {
    const r = await createRecurrence(A.db, A.actor, mkId(), values({ frequency: "monthly", startDate: "2031-01-31", time: "09:00" }), [], TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const dates = (await occurrencesOf(r.id)).map((o) => o.occurrence_date);
    expect(dates).toEqual(["2031-01-31", "2031-02-28", "2031-03-31", "2031-04-30", "2031-05-31", "2031-06-30"]);
  });

  it("a cada 10 dias", async () => {
    const r = await createRecurrence(A.db, A.actor, mkId(), values({ frequency: "every_days", intervalDays: "10", startDate: "2031-01-02", time: "08:00" }), [], TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const dates = (await occurrencesOf(r.id)).map((o) => o.occurrence_date);
    expect(dates.slice(0, 4)).toEqual(["2031-01-02", "2031-01-12", "2031-01-22", "2031-02-01"]);
    expect(dates.at(-1)! <= HORIZON).toBe(true);
  });

  it("datas puladas não geram atendimento e ficam registradas na regra", async () => {
    const r = await createRecurrence(A.db, A.actor, mkId(), values({ time: "11:00", endDate: "2031-02-04" }), ["2031-01-14"], TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await occurrencesOf(r.id)).map((o) => o.occurrence_date)).toEqual(["2031-01-07", "2031-01-21", "2031-01-28", "2031-02-04"]);
    const { data } = await admin.from("recurrences").select("skipped_dates, end_date").eq("id", r.id).single();
    expect(data).toMatchObject({ skipped_dates: ["2031-01-14"], end_date: "2031-02-04" });
  });

  it("reenviar a mesma tentativa não duplica a recorrência nem os atendimentos", async () => {
    const id = mkId();
    const v = values({ time: "12:00", endDate: "2031-01-28" });
    const first = await createRecurrence(A.db, A.actor, id, v, [], TODAY);
    const second = await createRecurrence(A.db, A.actor, id, v, [], TODAY);
    expect(first).toMatchObject({ ok: true, created: 4 });
    expect(second).toMatchObject({ ok: true, created: 0 });
    expect(await occurrencesOf(id)).toHaveLength(4);
    const { count } = await admin.from("recurrences").select("id", { count: "exact", head: true }).eq("id", id);
    expect(count).toBe(1);
  });

  it("recusa: data de início passada, serviço de outra profissional, serviço desativado, cliente arquivada, dados inválidos", async () => {
    expect(await createRecurrence(A.db, A.actor, mkId(), values({ startDate: "2030-12-31" }), [], TODAY)).toMatchObject({ ok: false, error: expect.stringContaining("passada") });
    expect(await createRecurrence(A.db, A.actor, mkId(), values({ serviceId: svcB }), [], TODAY)).toMatchObject({ ok: false, error: "Serviço não encontrado." });
    expect(await createRecurrence(A.db, A.actor, "nao-e-uuid", values(), [], TODAY)).toMatchObject({ ok: false });
    expect(await createRecurrence(A.db, A.actor, mkId(), values({ frequency: "every_days", intervalDays: "0" }), [], TODAY)).toMatchObject({ ok: false });

    const off = (await A.db.from("services").insert({ salon_id: A.actor.salonId, professional_id: A.actor.professionalId, name: `${MARK} Desativado`, default_duration_minutes: 30, default_price: 10, active: false }).select("id").single()).data!.id;
    expect(await createRecurrence(A.db, A.actor, mkId(), values({ serviceId: off }), [], TODAY)).toMatchObject({ ok: false, error: "Este serviço está desativado." });

    const arch = (await A.db.from("clients").insert({ salon_id: A.actor.salonId, full_name: `${MARK} Arquivada`, phone: "5511966662222", archived_at: new Date().toISOString() }).select("id").single()).data!.id;
    expect(await createRecurrence(A.db, A.actor, mkId(), values({ clientId: arch }), [], TODAY)).toMatchObject({ ok: false });
  });
});

describe("privacidade", () => {
  it("a colega não enxerga nem altera a recorrência, e a reposição dela não toca a da outra", async () => {
    const r = await createRecurrence(A.db, A.actor, mkId(), values({ time: "13:00", endDate: "2031-01-21" }), [], TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const seen = await B.db.from("recurrences").select("id").eq("id", r.id);
    expect(seen.data ?? []).toHaveLength(0);
    const hidden = await B.db.from("appointments").select("id").eq("recurrence_id", r.id);
    expect(hidden.data ?? []).toHaveLength(0);
    expect(await endRecurrence(B.db, B.actor, r.id, TODAY)).toMatchObject({ ok: false });
    const upd = await B.db.from("recurrences").update({ ended_at: new Date().toISOString() }).eq("id", r.id).select("id");
    expect(upd.data ?? []).toHaveLength(0);
    expect((await topUpRecurrences(B.db, B.actor, TODAY)).created).toBe(0);
    expect(await occurrencesOf(r.id)).toHaveLength(3);
  });
});

describe("conferir antes de criar", () => {
  it("marca como conflito só a data que cruza outro atendimento da própria profissional", async () => {
    // atendimento avulso na terça 14/01/2031, 20:20–21:00 (horário que nenhuma outra série deste teste usa)
    const avulso = await createAppointment(A.db, A.actor, mkId(), { clientId, serviceId: svcA, date: "2031-01-14", time: "20:20", durationMinutes: "40", price: "50,00", notes: "" }, true);
    expect(avulso.ok).toBe(true);
    const p = await previewRecurrence(A.db, A.actor, values({ time: "20:00", endDate: "2031-01-28" }), { today: TODAY });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.occurrences.map((o) => [o.date, o.conflict])).toEqual([["2031-01-07", false], ["2031-01-14", true], ["2031-01-21", false], ["2031-01-28", false]]);
    expect(p.conflicts).toBe(1);
  });

  it("os atendimentos da colega não geram conflito (agenda privada)", async () => {
    const dela = await createAppointment(B.db, B.actor, mkId(), { clientId, serviceId: svcB, date: "2031-02-04", time: "21:00", durationMinutes: "40", price: "50,00", notes: "" }, true);
    expect(dela.ok).toBe(true);
    const p = await previewRecurrence(A.db, A.actor, values({ startDate: "2031-02-04", time: "21:00", endDate: "2031-02-04" }), { today: TODAY });
    expect(p).toMatchObject({ ok: true, conflicts: 0 });
  });

  it("não grava nada na conferência", async () => {
    const antes = await admin.from("recurrences").select("id", { count: "exact", head: true }).eq("client_id", clientId);
    await previewRecurrence(A.db, A.actor, values({ time: "15:00" }), { today: TODAY });
    const depois = await admin.from("recurrences").select("id", { count: "exact", head: true }).eq("client_id", clientId);
    expect(depois.count).toBe(antes.count);
  });
});

describe("repor (ao abrir o app)", () => {
  it("é idempotente, não recria dia cancelado nem data pulada, e avança com o tempo", async () => {
    const r = await createRecurrence(A.db, A.actor, mkId(), values({ time: "16:00", startDate: "2031-01-07" }), ["2031-01-21"], TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const inicial = (await occurrencesOf(r.id)).length;

    // cancela um dia (pelo fluxo normal)
    const [primeiro] = await occurrencesOf(r.id);
    expect(await setAppointmentStatus(A.db, A.actor, primeiro.id, "cancelled")).toMatchObject({ ok: true });

    // repor no mesmo dia: nada muda
    expect((await topUpRecurrences(A.db, A.actor, TODAY)).created).toBe(0);
    expect(await occurrencesOf(r.id)).toHaveLength(inicial);
    expect((await occurrencesOf(r.id, "cancelled")).map((o) => o.occurrence_date)).toEqual(["2031-01-07"]);
    expect((await occurrencesOf(r.id)).some((o) => o.occurrence_date === "2031-01-21")).toBe(false); // pulada

    // 3 semanas depois o horizonte avança: aparecem as novas datas, e só elas
    const later = "2031-01-22";
    const topUp = await topUpRecurrences(A.db, A.actor, later);
    expect(topUp.created).toBeGreaterThan(0);
    const dates = (await occurrencesOf(r.id)).map((o) => o.occurrence_date);
    expect(new Set(dates).size).toBe(dates.length); // sem duplicata
    expect(dates.at(-1)! <= horizonEnd(later)).toBe(true);
    expect(dates).not.toContain("2031-01-21");
    expect((await topUpRecurrences(A.db, A.actor, later)).created).toBe(0);
  });

  it("duas reposições ao mesmo tempo (dois celulares) não duplicam", async () => {
    const r = await createRecurrence(A.db, A.actor, mkId(), values({ time: "17:00", startDate: "2031-01-07" }), [], TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await Promise.all([topUpRecurrences(A.db, A.actor, "2031-02-15"), topUpRecurrences(A.db, A.actor, "2031-02-15")]);
    const dates = (await occurrencesOf(r.id)).map((o) => o.occurrence_date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("recorrência encerrada não é reposta", async () => {
    const r = await createRecurrence(A.db, A.actor, mkId(), values({ time: "18:00" }), [], TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await endRecurrence(A.db, A.actor, r.id, TODAY)).toMatchObject({ ok: true });
    const total = (await occurrencesOf(r.id)).length;
    await topUpRecurrences(A.db, A.actor, "2031-04-01");
    expect(await occurrencesOf(r.id)).toHaveLength(total);
  });
});

describe("encerrar", () => {
  it("cancela só os futuros que aguardam confirmação; confirmados e concluídos ficam", async () => {
    const r = await createRecurrence(A.db, A.actor, mkId(), values({ time: "19:00", endDate: "2031-02-11" }), [], TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const occ = await occurrencesOf(r.id); // 07/01, 14/01, 21/01, 28/01, 04/02, 11/02
    expect(occ).toHaveLength(6);
    await setAppointmentStatus(A.db, A.actor, occ[2].id, "confirmed"); // 21/01
    await setAppointmentStatus(A.db, A.actor, occ[3].id, "completed"); // 28/01

    const end = await endRecurrence(A.db, A.actor, r.id, "2031-01-15");
    expect(end).toMatchObject({ ok: true, cancelled: 2, kept: 2 }); // de 15/01 em diante: 21/01 e 28/01 ficam; 04/02 e 11/02 são cancelados
    const status = Object.fromEntries((await occurrencesOf(r.id)).map((o) => [o.occurrence_date, o.status]));
    expect(status["2031-01-07"]).toBe("awaiting_confirmation"); // passado: intocado
    expect(status["2031-01-14"]).toBe("awaiting_confirmation"); // antes de "hoje" (15/01): intocado
    expect(status["2031-01-21"]).toBe("confirmed");
    expect(status["2031-01-28"]).toBe("completed");
    expect(status["2031-02-04"]).toBe("cancelled");
    expect(status["2031-02-11"]).toBe("cancelled");
    const { data } = await admin.from("recurrences").select("ended_at").eq("id", r.id).single();
    expect(data!.ended_at).not.toBeNull();
    expect(await endRecurrence(A.db, A.actor, r.id, "2031-01-15")).toMatchObject({ ok: false }); // já encerrada
  });
});

describe("alterar a partir de uma data", () => {
  it("troca horário e preço dali em diante, mantém o passado e os já confirmados", async () => {
    const old = await createRecurrence(A.db, A.actor, mkId(), values({ time: "08:00", endDate: "2031-02-18" }), [], TODAY);
    expect(old.ok).toBe(true);
    if (!old.ok) return;
    const occ = await occurrencesOf(old.id); // 07/01 14/01 21/01 28/01 04/02 11/02 18/02
    await setAppointmentStatus(A.db, A.actor, occ[4].id, "confirmed"); // 04/02 confirmado: deve ficar

    const newId = mkId();
    const r = await changeRecurrenceFrom(A.db, A.actor, old.id, newId, values({ time: "08:30", price: "70,00", startDate: "2031-01-28", endDate: "2031-02-18" }), ["2031-02-04"], "2031-01-15");
    expect(r).toMatchObject({ ok: true, cancelled: 3, kept: 1 }); // cancela 28/01, 11/02, 18/02; mantém 04/02 confirmado

    const antigos = Object.fromEntries((await occurrencesOf(old.id)).map((o) => [o.occurrence_date, o.status]));
    expect(antigos["2031-01-07"]).toBe("awaiting_confirmation");
    expect(antigos["2031-01-14"]).toBe("awaiting_confirmation");
    expect(antigos["2031-01-21"]).toBe("awaiting_confirmation");
    expect(antigos["2031-01-28"]).toBe("cancelled");
    expect(antigos["2031-02-04"]).toBe("confirmed");
    expect(antigos["2031-02-11"]).toBe("cancelled");

    const novos = await occurrencesOf(newId);
    expect(novos.map((o) => o.occurrence_date)).toEqual(["2031-01-28", "2031-02-11", "2031-02-18"]); // 04/02 pulada
    expect(novos.every((o) => Number(o.price_at_booking) === 70 && toZonedParts(o.start_at).time === "08:30")).toBe(true);

    const { data: oldRec } = await admin.from("recurrences").select("ended_at, end_date").eq("id", old.id).single();
    expect(oldRec).toMatchObject({ end_date: "2031-01-27" });
    expect(oldRec!.ended_at).not.toBeNull();
    // repor depois não mistura as séries
    await topUpRecurrences(A.db, A.actor, "2031-01-15");
    expect((await occurrencesOf(old.id)).filter((o) => o.occurrence_date >= "2031-01-28" && o.status !== "cancelled" && o.status !== "confirmed")).toHaveLength(0);
  });

  it("não altera recorrência de outra profissional nem já encerrada, e a regra antiga é preservada se os dados forem inválidos", async () => {
    const old = await createRecurrence(A.db, A.actor, mkId(), values({ time: "07:00", endDate: "2031-01-21" }), [], TODAY);
    expect(old.ok).toBe(true);
    if (!old.ok) return;
    expect(await changeRecurrenceFrom(B.db, B.actor, old.id, mkId(), values({ serviceId: svcB, time: "07:30" }), [], TODAY)).toMatchObject({ ok: false });
    expect(await changeRecurrenceFrom(A.db, A.actor, old.id, mkId(), values({ time: "xx" }), [], TODAY)).toMatchObject({ ok: false });
    expect(await changeRecurrenceFrom(A.db, A.actor, old.id, mkId(), values({ serviceId: svcB }), [], TODAY)).toMatchObject({ ok: false });
    expect((await occurrencesOf(old.id, "awaiting_confirmation")).length).toBe(3); // nada foi cancelado
    const { data } = await admin.from("recurrences").select("ended_at").eq("id", old.id).single();
    expect(data!.ended_at).toBeNull();
  });
});
