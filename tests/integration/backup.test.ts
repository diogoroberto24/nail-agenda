import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { TABLES, runBackup } from "../../scripts/backup.mjs";
import { runRestore } from "../../scripts/restore.mjs";

/**
 * Backup e restauração contra o Supabase REAL.
 * Cria dados marcados com __teste_backup__ (cliente, serviço e atendimento, que dependem uns dos outros),
 * faz o backup, APAGA esses dados, restaura e confere que voltaram idênticos.
 * Os dados reais não são alterados (a restauração só insere o que falta, nunca atualiza).
 */
const MARK = "__teste_backup__";
const env = process.env;
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

type Report = Record<string, { noBackup: number; faltando: number; restauradas: number }>;

let dir: string;
let ids: { client: string; service: string; appointment: string };
let original: { client: Record<string, unknown>; service: Record<string, unknown>; appointment: Record<string, unknown> };

async function countRealRows() {
  const out: Record<string, number> = {};
  for (const t of TABLES as string[]) {
    const { count } = await admin.from(t).select("*", { count: "exact", head: true });
    out[t] = count ?? 0;
  }
  return out;
}

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "nail-backup-"));
  const pro = (await admin.from("professionals").select("id, salon_id, user_id").limit(1).single()).data!;
  const client = (await admin.from("clients").insert({ salon_id: pro.salon_id, full_name: `${MARK} Cliente`, phone: "5511966660000", notes: "acentuação: ção, é, ü" }).select("*").single()).data!;
  const service = (await admin.from("services").insert({ salon_id: pro.salon_id, professional_id: pro.id, name: `${MARK} Serviço`, default_duration_minutes: 40, default_price: 55.5 }).select("*").single()).data!;
  const start = new Date("2031-12-01T13:00:00Z");
  const appt = (
    await admin
      .from("appointments")
      .insert({
        salon_id: pro.salon_id, professional_id: pro.id, client_id: client.id, service_id: service.id,
        start_at: start.toISOString(), end_at: new Date(start.getTime() + 40 * 60000).toISOString(),
        duration_minutes_at_booking: 40, price_at_booking: 55.5, status: "confirmed", notes: "obs", created_by: pro.user_id,
      })
      .select("*")
      .single()
  ).data!;
  ids = { client: client.id, service: service.id, appointment: appt.id };
  original = { client, service, appointment: appt };
});

afterAll(async () => {
  await admin.from("appointments").delete().eq("id", ids.appointment);
  await admin.from("services").delete().eq("id", ids.service);
  await admin.from("clients").delete().eq("id", ids.client);
  rmSync(dir, { recursive: true, force: true });
});

describe("backup e restauração", () => {
  it("o backup grava as 9 tabelas, as contas (sem senhas) e confere as contagens", async () => {
    const manifest = (await runBackup(dir)) as unknown as { counts: Record<string, number>; source: string };
    for (const t of TABLES as string[]) expect(existsSync(path.join(dir, `${t}.json`)), t).toBe(true);
    expect(existsSync(path.join(dir, "auth_users.json"))).toBe(true);

    const users = JSON.parse(readFileSync(path.join(dir, "auth_users.json"), "utf8"));
    expect(users.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(users[0]).sort()).toEqual(["created_at", "email", "id", "last_sign_in_at"]); // nenhum segredo
    const raw = readFileSync(path.join(dir, "auth_users.json"), "utf8");
    expect(raw).not.toMatch(/password|encrypted|token/i);

    const clients = JSON.parse(readFileSync(path.join(dir, "clients.json"), "utf8"));
    expect(clients.some((c: { id: string }) => c.id === ids.client)).toBe(true);
    expect(manifest.counts.clients).toBe(clients.length);
    expect(manifest.source).toContain("<projeto>"); // o endereço do projeto não vai no manifesto
  });

  it("depois de apagar os dados, a simulação mostra o que falta e NÃO grava nada", async () => {
    // apaga na ordem inversa das dependências
    await admin.from("appointments").delete().eq("id", ids.appointment);
    await admin.from("services").delete().eq("id", ids.service);
    await admin.from("clients").delete().eq("id", ids.client);
    const gone = await admin.from("clients").select("id").eq("id", ids.client);
    expect(gone.data).toHaveLength(0);

    const report = (await runRestore(dir, { confirm: false })) as unknown as Report;
    expect(report.clients.faltando).toBe(1);
    expect(report.services.faltando).toBe(1);
    expect(report.appointments.faltando).toBe(1);
    expect(report.clients.restauradas).toBe(0);
    expect((await admin.from("clients").select("id").eq("id", ids.client)).data).toHaveLength(0);
  });

  it("a restauração devolve cliente, serviço e atendimento idênticos ao original (ordem das dependências respeitada)", async () => {
    const realBefore = await countRealRows();
    const report = (await runRestore(dir, { confirm: true })) as unknown as Report;
    expect(report.clients.restauradas).toBe(1);
    expect(report.services.restauradas).toBe(1);
    expect(report.appointments.restauradas).toBe(1);

    const client = (await admin.from("clients").select("*").eq("id", ids.client).single()).data;
    const service = (await admin.from("services").select("*").eq("id", ids.service).single()).data;
    const appointment = (await admin.from("appointments").select("*").eq("id", ids.appointment).single()).data;
    expect(client).toEqual(original.client);
    expect(service).toEqual(original.service);
    expect(appointment).toEqual(original.appointment);

    const after = await countRealRows();
    expect(after.clients).toBe(realBefore.clients + 1);
    expect(after.appointments).toBe(realBefore.appointments + 1);
    expect(after.salons).toBe(realBefore.salons);
    expect(after.professionals).toBe(realBefore.professionals);
  });

  it("rodar a restauração de novo não muda nada (idempotente) e não altera dados existentes", async () => {
    const realClient = (await admin.from("clients").select("*").neq("id", ids.client).limit(1)).data?.[0];
    const report = (await runRestore(dir, { confirm: true })) as unknown as Report;
    for (const t of TABLES as string[]) expect(report[t].faltando, t).toBe(0);
    if (realClient) {
      const same = (await admin.from("clients").select("*").eq("id", realClient.id).single()).data;
      expect(same).toEqual(realClient); // inclusive updated_at: nada foi reescrito
    }
  });

  it("pasta inválida é recusada com mensagem clara", async () => {
    await expect(runRestore(path.join(dir, "nao-existe"), { confirm: true })).rejects.toThrow(/Pasta de backup inválida/);
  });
});
