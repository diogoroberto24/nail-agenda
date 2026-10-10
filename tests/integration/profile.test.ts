import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { changePassword, requestEmailChange, updateDisplayName } from "@/lib/profile/service";

/**
 * Perfil contra o Supabase REAL, usando uma conta DESCARTÁVEL (criada e apagada no teste).
 * As contas de teste do seed não são tocadas. A troca de e-mail com sucesso NÃO é exercitada
 * aqui porque o Supabase enviaria um e-mail de verdade.
 */
const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL!;
const mk = (key: string) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = mk(env.SUPABASE_SECRET_KEY!);

const EMAIL = `__teste_perfil_${Date.now()}@example.com`;
const PASSWORD = "SenhaInicial#2031";
const NEW_PASSWORD = "SenhaNova#2031x";

let userId: string;
let professionalId: string;
let salonId: string;
let db: SupabaseClient;

async function signIn(email: string, password: string) {
  const c = mk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  return { c, data, error };
}

beforeAll(async () => {
  const created = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "__teste__ Perfil" } });
  if (created.error) throw new Error(created.error.message);
  userId = created.data.user.id;

  const salon = await admin.from("salons").select("id").limit(1).single();
  salonId = salon.data!.id;
  await admin.from("salon_members").insert({ salon_id: salonId, user_id: userId, role: "professional" });
  const pro = await admin.from("professionals").insert({ salon_id: salonId, user_id: userId, display_name: "__teste__ Perfil" }).select("id").single();
  professionalId = pro.data!.id;

  db = (await signIn(EMAIL, PASSWORD)).c;
});

afterAll(async () => {
  await admin.from("professionals").delete().eq("user_id", userId);
  await admin.from("salon_members").delete().eq("user_id", userId);
  await admin.auth.admin.deleteUser(userId);
});

describe("nome de exibição", () => {
  it("atualiza o nome da profissional e o do perfil", async () => {
    const r = await updateDisplayName(db, { professionalId, userId }, { displayName: "  __teste__ Nova Ana " });
    expect(r).toMatchObject({ ok: true });
    const pro = await admin.from("professionals").select("display_name").eq("id", professionalId).single();
    const profile = await admin.from("profiles").select("full_name").eq("id", userId).single();
    expect(pro.data!.display_name).toBe("__teste__ Nova Ana");
    expect(profile.data!.full_name).toBe("__teste__ Nova Ana");
  });

  it("recusa nome vazio ou curto demais sem alterar nada", async () => {
    expect(await updateDisplayName(db, { professionalId, userId }, { displayName: " " })).toMatchObject({ ok: false });
    expect(await updateDisplayName(db, { professionalId, userId }, { displayName: "A" })).toMatchObject({ ok: false });
    const pro = await admin.from("professionals").select("display_name").eq("id", professionalId).single();
    expect(pro.data!.display_name).toBe("__teste__ Nova Ana");
  });

  it("não consegue alterar o nome de outra profissional", async () => {
    const other = await admin.from("professionals").select("id, display_name").neq("id", professionalId).neq("user_id", userId).limit(1).single();
    const r = await updateDisplayName(db, { professionalId: other.data!.id, userId }, { displayName: "__teste__ Invasora" });
    expect(r).toMatchObject({ ok: false });
    const after = await admin.from("professionals").select("display_name").eq("id", other.data!.id).single();
    expect(after.data!.display_name).toBe(other.data!.display_name);
  });
});

describe("troca de senha", () => {
  it("recusa senha atual errada e não muda nada", async () => {
    const r = await changePassword(db, EMAIL, { currentPassword: "errada-errada-1", newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(r).toEqual({ ok: false, error: "Senha atual incorreta.", field: "currentPassword" });
    expect((await signIn(EMAIL, PASSWORD)).error).toBeNull();
  });

  it("recusa senha nova fraca, igual à atual ou sem confirmação igual", async () => {
    expect(await changePassword(db, EMAIL, { currentPassword: PASSWORD, newPassword: "curta", confirmPassword: "curta" })).toMatchObject({ ok: false });
    expect(await changePassword(db, EMAIL, { currentPassword: PASSWORD, newPassword: PASSWORD, confirmPassword: PASSWORD })).toMatchObject({ ok: false });
    expect(await changePassword(db, EMAIL, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: "outra" })).toMatchObject({ ok: false });
    expect((await signIn(EMAIL, PASSWORD)).error).toBeNull();
  });

  it("com a senha atual certa: troca; a nova entra e a antiga deixa de entrar", async () => {
    const r = await changePassword(db, EMAIL, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(r).toMatchObject({ ok: true });
    expect((await signIn(EMAIL, NEW_PASSWORD)).error).toBeNull();
    expect((await signIn(EMAIL, PASSWORD)).error).not.toBeNull();
  });
});

describe("troca de e-mail (sem enviar e-mail de verdade)", () => {
  it("exige a senha atual e recusa o mesmo e-mail; nada muda", async () => {
    const wrong = await requestEmailChange(db, EMAIL, { newEmail: "outro@example.com", currentPassword: "errada-errada-1" });
    expect(wrong).toMatchObject({ ok: false, error: "Senha atual incorreta.", field: "currentPassword" });

    const same = await requestEmailChange(db, EMAIL, { newEmail: EMAIL.toUpperCase(), currentPassword: NEW_PASSWORD });
    expect(same).toMatchObject({ ok: false, field: "newEmail" });

    const invalid = await requestEmailChange(db, EMAIL, { newEmail: "isso-nao-e-email", currentPassword: NEW_PASSWORD });
    expect(invalid).toMatchObject({ ok: false, field: "newEmail" });

    const user = await admin.auth.admin.getUserById(userId);
    expect(user.data.user!.email).toBe(EMAIL);
    expect(user.data.user!.new_email ?? null).toBeNull();
  });
});
