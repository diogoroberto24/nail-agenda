import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { signUpProfessional } from "@/lib/auth/signup";

/**
 * Cadastro com código de convite contra o Supabase REAL (só a chave pública, como no site).
 * - código errado: recusado, nada é criado
 * - sem código: a conta nasce SEM acesso (não é membra do salão, não lê nada)
 * - código certo: só roda se SIGNUP_TEST_INVITE_CODE estiver no .env.local (nunca coloque o código no Git)
 * Exige as migrações do cadastro (20261010000002) já aplicadas e um código definido no banco.
 */
const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL!;
const mk = (key: string) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = mk(env.SUPABASE_SECRET_KEY!);

const stamp = Date.now();
const emails: string[] = [];
const email = (tag: string) => {
  const e = `teste-cadastro-${tag}-${stamp}@exemplo.com`;
  emails.push(e);
  return e;
};
const PASSWORD = "senha-de-teste-1234";
const base = (tag: string, inviteCode: string) => ({ fullName: `__teste__ ${tag}`, email: email(tag), password: PASSWORD, confirmPassword: PASSWORD, inviteCode });

async function userIdOf(e: string) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data.users.find((u) => u.email === e)?.id;
}

afterAll(async () => {
  for (const e of emails) {
    const id = await userIdOf(e);
    if (!id) continue;
    await admin.from("professionals").delete().eq("user_id", id);
    await admin.from("salon_members").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id);
  }
});

describe("cadastro no banco real", () => {
  it("código errado é recusado e nenhuma conta é criada", async () => {
    const v = base("errado", "codigo-que-nao-existe-123");
    const result = await signUpProfessional(mk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!), v);
    expect(result).toMatchObject({ ok: false, kind: "invite", error: "Código de convite inválido." });
    expect(await userIdOf(v.email)).toBeUndefined();
  });

  it("chamar a API direto, sem código: a conta nasce sem acesso a nada", async () => {
    const e = email("semcodigo");
    const db = mk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    const { data, error } = await db.auth.signUp({ email: e, password: PASSWORD, options: { data: { full_name: "Sem Convite" } } });
    expect(error).toBeNull();
    const userId = data.user!.id;

    const pros = await admin.from("professionals").select("id").eq("user_id", userId);
    const members = await admin.from("salon_members").select("user_id").eq("user_id", userId);
    expect(pros.data).toHaveLength(0);
    expect(members.data).toHaveLength(0);

    // mesmo logada, não lê clientes, serviços, atendimentos nem profissionais
    if (data.session) {
      for (const table of ["clients", "services", "appointments", "professionals", "salons"]) {
        const r = await db.from(table).select("id").limit(5);
        expect(r.data ?? [], table).toHaveLength(0);
      }
    }
  });

  it("código de convite no metadado vazio ou só espaços não vale", async () => {
    const v = base("vazio", "   ");
    expect(await signUpProfessional(mk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!), v)).toMatchObject({ ok: false, kind: "validation" });
  });

  const real = env.SIGNUP_TEST_INVITE_CODE;
  it.skipIf(!real)("código certo: entra no salão como profissional, com o nome informado, e não vê atendimentos de ninguém", async () => {
    const v = base("certo", real!);
    const db = mk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    expect(await signUpProfessional(db, v)).toEqual({ ok: true });

    const userId = (await userIdOf(v.email))!;
    const pro = await admin.from("professionals").select("display_name, active").eq("user_id", userId).single();
    expect(pro.data).toMatchObject({ display_name: "__teste__ certo", active: true });

    const signedIn = await db.auth.signInWithPassword({ email: v.email, password: PASSWORD });
    expect(signedIn.error).toBeNull();
    const clients = await db.from("clients").select("id").limit(1);
    expect(clients.error).toBeNull();
    const appts = await db.from("appointments").select("id").limit(5);
    expect(appts.data ?? []).toHaveLength(0);
  });
});
