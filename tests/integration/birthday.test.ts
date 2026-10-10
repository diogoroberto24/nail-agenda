import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { birthdayPairsFor } from "@/lib/clients/birthday";

/**
 * Aniversário da cliente contra o Supabase REAL (exige a migração 20261011000001 aplicada).
 * A consulta de "aniversariantes de hoje" é a mesma de src/lib/data/clients.ts (listBirthdaysToday).
 */
const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL!;
const mk = (key: string) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = mk(env.SUPABASE_SECRET_KEY!);

const MARK = "__teste_aniversario__";
let A: SupabaseClient;
let B: SupabaseClient;
let salonId: string;
const ids: Record<string, string> = {};

async function birthdaysOn(db: SupabaseClient, today: string) {
  const filter = birthdayPairsFor(today).map((p) => `and(birth_day.eq.${p.day},birth_month.eq.${p.month})`).join(",");
  const { data, error } = await db.from("clients").select("id, full_name, phone, birth_year").is("archived_at", null).or(filter).limit(100);
  expect(error).toBeNull();
  return (data ?? []).filter((c) => c.full_name.startsWith(MARK)).map((c) => c.full_name.replace(`${MARK} `, "")).sort();
}

beforeAll(async () => {
  const login = async (email: string, password: string) => {
    const db = mk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return db;
  };
  A = await login(env.SEED_PRO1_EMAIL!, env.SEED_PRO1_PASSWORD!);
  B = await login(env.SEED_PRO2_EMAIL!, env.SEED_PRO2_PASSWORD!);
  salonId = (await admin.from("salons").select("id").limit(1).single()).data!.id;

  const mkClient = async (key: string, phone: string, extra: Record<string, unknown>) => {
    const { data, error } = await admin.from("clients").insert({ salon_id: salonId, full_name: `${MARK} ${key}`, phone, ...extra }).select("id").single();
    expect(error).toBeNull();
    ids[key] = data!.id;
  };
  await mkClient("Ana (10/10)", "5511944440001", { birth_day: 10, birth_month: 10, birth_year: 1990 });
  await mkClient("Bia (10/10 sem ano)", "5511944440002", { birth_day: 10, birth_month: 10 });
  await mkClient("Carla (11/10)", "5511944440003", { birth_day: 11, birth_month: 10 });
  await mkClient("Dani (10/10 arquivada)", "5511944440004", { birth_day: 10, birth_month: 10, archived_at: new Date().toISOString() });
  await mkClient("Eva (sem aniversario)", "5511944440005", {});
  await mkClient("Fabi (29/02)", "5511944440006", { birth_day: 29, birth_month: 2 });
});

afterAll(async () => {
  await admin.from("clients").delete().like("full_name", `${MARK}%`);
});

describe("aniversariantes no banco real", () => {
  it("lista só quem faz aniversário no dia, ativa, com ou sem ano", async () => {
    expect(await birthdaysOn(A, "2026-10-10")).toEqual(["Ana (10/10)", "Bia (10/10 sem ano)"]);
  });

  it("a colega vê as mesmas aniversariantes (cadastro compartilhado)", async () => {
    expect(await birthdaysOn(B, "2026-10-10")).toEqual(await birthdaysOn(A, "2026-10-10"));
  });

  it("outro dia mostra outras pessoas; dia sem aniversário, ninguém", async () => {
    expect(await birthdaysOn(A, "2026-10-11")).toEqual(["Carla (11/10)"]);
    expect(await birthdaysOn(A, "2026-05-05")).toEqual([]);
  });

  it("29/02: lembrada em 28/02 de ano não bissexto; em ano bissexto, só em 29/02", async () => {
    expect(await birthdaysOn(A, "2026-02-28")).toEqual(["Fabi (29/02)"]);
    expect(await birthdaysOn(A, "2028-02-28")).toEqual([]);
    expect(await birthdaysOn(A, "2028-02-29")).toEqual(["Fabi (29/02)"]);
  });

  it("arquivada não aparece", async () => {
    expect((await birthdaysOn(A, "2026-10-10")).some((n) => n.startsWith("Dani"))).toBe(false);
  });

  it("o banco recusa datas impossíveis e a profissional edita o aniversário (cadastro compartilhado)", async () => {
    const bad = await A.from("clients").update({ birth_day: 31, birth_month: 2 }).eq("id", ids["Eva (sem aniversario)"]).select("id");
    expect(bad.error?.message).toMatch(/clients_birthday_valid|check constraint/i);
    const partial = await A.from("clients").update({ birth_day: 10 }).eq("id", ids["Eva (sem aniversario)"]).select("id");
    expect(partial.error).not.toBeNull(); // dia sem mês

    const ok = await B.from("clients").update({ birth_day: 3, birth_month: 7, birth_year: 1985 }).eq("id", ids["Eva (sem aniversario)"]).select("birth_day, birth_month, birth_year").single();
    expect(ok.error).toBeNull();
    expect(ok.data).toEqual({ birth_day: 3, birth_month: 7, birth_year: 1985 });

    const clear = await A.from("clients").update({ birth_day: null, birth_month: null, birth_year: null }).eq("id", ids["Eva (sem aniversario)"]).select("birth_day").single();
    expect(clear.error).toBeNull();
    expect(clear.data?.birth_day).toBeNull();
  });
});
