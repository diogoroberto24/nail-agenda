import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildClientSearchFilter } from "@/lib/clients/search";

/** A busca de clientes (nome/telefone, com escape de _ e %) contra o Supabase REAL, com a profissional 1 logada. */
const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL!;
const mk = (key: string) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = mk(env.SUPABASE_SECRET_KEY!);

const MARK = "__teste_busca__";
let db: SupabaseClient;
let salonId: string;

async function search(q: string) {
  const filter = buildClientSearchFilter(q);
  let query = db.from("clients").select("full_name").like("full_name", `${MARK}%`).is("archived_at", null);
  if (filter) query = query.or(filter);
  const { data, error } = await query;
  expect(error).toBeNull();
  return (data ?? []).map((c) => c.full_name.replace(`${MARK} `, "")).sort((a, b) => a.localeCompare(b));
}

beforeAll(async () => {
  db = mk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { error } = await db.auth.signInWithPassword({ email: env.SEED_PRO1_EMAIL!, password: env.SEED_PRO1_PASSWORD! });
  if (error) throw new Error(error.message);
  salonId = (await db.from("salons").select("id").single()).data!.id;

  const rows = [
    ["Ana_Maria Silva", "5511977770001"],
    ["AnaXMaria Souza", "5511977770002"],
    ["100% Feliz", "5511977770003"],
    ["José da Conceição", "5511977770004"],
  ].map(([name, phone]) => ({ salon_id: salonId, full_name: `${MARK} ${name}`, phone }));
  const { error: insertError } = await admin.from("clients").insert(rows);
  if (insertError) throw new Error(insertError.message);
});

afterAll(async () => {
  await admin.from("clients").delete().like("full_name", `${MARK}%`);
});

describe("busca de clientes no banco real", () => {
  it("por trecho do nome, sem diferenciar maiúsculas", async () => {
    expect(await search("ana")).toEqual(["Ana_Maria Silva", "AnaXMaria Souza"].sort((a, b) => a.localeCompare(b)));
    expect(await search("SILVA")).toEqual(["Ana_Maria Silva"]);
  });

  it("underline é texto e não curinga: 'Ana_Maria' acha só quem tem o underline", async () => {
    expect(await search("Ana_Maria")).toEqual(["Ana_Maria Silva"]);
    expect(await search("Ana_")).toEqual(["Ana_Maria Silva"]);
  });

  it("porcentagem é texto e não curinga: '%' sozinho acha só o nome com %", async () => {
    expect(await search("100%")).toEqual(["100% Feliz"]);
    expect(await search("%")).toEqual(["100% Feliz"]);
  });

  it("por telefone, em qualquer formato digitado", async () => {
    expect(await search("11977770001")).toEqual(["Ana_Maria Silva"]);
    expect(await search("(11) 97777-0003")).toEqual(["100% Feliz"]);
    expect(await search("977770")).toHaveLength(4);
  });

  it("sem resultado e entradas estranhas não quebram a busca", async () => {
    expect(await search("zzz-nao-existe")).toEqual([]);
    expect(await search('Ana,archived_at.is.null)"\\')).toEqual([]);
    expect(await search("   ")).toHaveLength(4); // sem filtro: lista tudo (dos de teste)
  });

  it("acento: a busca diferencia (limitação conhecida) mas o nome completo acha", async () => {
    expect(await search("José")).toEqual(["José da Conceição"]);
  });
});
