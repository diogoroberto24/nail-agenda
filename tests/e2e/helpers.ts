import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Marca de todos os dados criados pelos testes E2E (usada para limpar). */
export const MARK = "__e2e__";
export const AUTH_DIR = path.resolve("tests/e2e/.auth");
export const FIXTURE_FILE = path.join(AUTH_DIR, "fixture.json");

export function loadEnv() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SEED_PRO1_EMAIL", "SEED_PRO1_PASSWORD"]) {
    if (!process.env[k]) throw new Error(`Falta ${k} no .env.local (necessário para os testes E2E).`);
  }
}

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Fixture = {
  salonId: string;
  proA: { id: string; name: string };
  proB: { id: string; name: string };
  clientName: string;
  clientId: string;
  today: string;
  tomorrow: string;
  appointments: { confirmedA: string; awaitingA: string; awaitingB: string; todayA: string };
};

export function readFixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_FILE, "utf8"));
}

/** Apaga tudo que os testes E2E criaram (inclusive o que foi criado pela interface). */
export async function cleanup() {
  const admin = adminClient();
  const { data: clients } = await admin.from("clients").select("id").like("full_name", `${MARK}%`);
  const ids = (clients ?? []).map((c) => c.id);
  if (ids.length) await admin.from("appointments").delete().in("client_id", ids);
  await admin.from("services").delete().like("name", `${MARK}%`);
  if (ids.length) await admin.from("clients").delete().in("id", ids);
}

/**
 * Cria uma sessão NOVA pela API do Supabase (a mesma chamada que o app faz no login) e devolve
 * os cookies no formato do Playwright. Não digita senha em nenhum formulário.
 */
export async function createSessionState(email: string, password: string) {
  const { createServerClient } = await import("@supabase/ssr");
  const jar = new Map<string, string>();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sessão de teste não criada: ${error.message}`);
  await supabase.auth.getSession(); // garante que os cookies foram gravados

  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const base = { domain: "localhost", path: "/", expires, secure: false, sameSite: "Lax" as const };
  const cookies = [...jar].map(([name, value]) => ({ name, value, httpOnly: false, ...base }));
  cookies.push({ name: "na-remember", value: "1", httpOnly: true, ...base });
  return { cookies, origins: [] as never[] };
}
