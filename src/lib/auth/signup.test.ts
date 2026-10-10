import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signupSchema } from "./schemas";
import { classifySignupError, signupErrorMessage, SIGNUP_MESSAGES } from "./signup-errors";
import { signUpProfessional } from "./signup";

const valid = { fullName: "Maria Souza", email: "maria@exemplo.com", password: "senha-1234", confirmPassword: "senha-1234", inviteCode: "convite-123" };

describe("validação do cadastro", () => {
  it("aceita dados corretos e tira espaços das pontas", () => {
    const r = signupSchema.safeParse({ ...valid, fullName: "  Maria Souza ", email: " maria@exemplo.com ", inviteCode: " convite-123 " });
    expect(r.success && r.data).toMatchObject({ fullName: "Maria Souza", email: "maria@exemplo.com", inviteCode: "convite-123" });
  });

  it.each([
    [{ fullName: "" }, "fullName", "Informe seu nome."],
    [{ fullName: "A" }, "fullName", "Informe seu nome."],
    [{ fullName: "x".repeat(61) }, "fullName", "O nome está muito longo."],
    [{ email: "" }, "email", "Informe seu e-mail."],
    [{ email: "nao-e-email" }, "email", "E-mail inválido."],
    [{ password: "curta12", confirmPassword: "curta12" }, "password", "A senha precisa ter pelo menos 8 caracteres."],
    [{ password: "x".repeat(73), confirmPassword: "x".repeat(73) }, "password", "A senha pode ter no máximo 72 caracteres."],
    [{ confirmPassword: "" }, "confirmPassword", "Repita a senha."],
    [{ confirmPassword: "outra-senha" }, "confirmPassword", "As senhas não são iguais."],
    [{ inviteCode: "   " }, "inviteCode", "Informe o código de convite."],
  ])("recusa %j", (patch, field, message) => {
    const r = signupSchema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.find((i) => i.path[0] === field)?.message).toBe(message);
  });

  it("senha de exatamente 8 caracteres é aceita", () => {
    expect(signupSchema.safeParse({ ...valid, password: "12345678", confirmPassword: "12345678" }).success).toBe(true);
  });
});

describe("mensagens de erro do cadastro", () => {
  it("o erro genérico do banco vira código de convite inválido", () => {
    expect(classifySignupError({ status: 500, code: "unexpected_failure", message: "Database error saving new user" })).toBe("invite");
    expect(signupErrorMessage({ status: 500, message: "Database error saving new user" }).message).toBe("Código de convite inválido.");
  });

  it("e-mail já cadastrado, senha fraca, limite e rede", () => {
    expect(classifySignupError({ status: 422, code: "user_already_exists" })).toBe("exists");
    expect(classifySignupError({ status: 400, message: "User already registered" })).toBe("exists");
    expect(classifySignupError({ status: 422, code: "weak_password" })).toBe("weak-password");
    expect(classifySignupError({ status: 429 })).toBe("rate-limit");
    expect(classifySignupError({ status: 422, code: "signup_disabled" })).toBe("disabled");
    expect(classifySignupError({ status: 0 })).toBe("network");
    expect(classifySignupError({ status: 418 })).toBe("unknown");
  });

  it("nenhuma mensagem revela detalhes internos", () => {
    for (const m of Object.values(SIGNUP_MESSAGES)) expect(m).not.toMatch(/trigger|database|sql/i);
  });
});

function fakeSupabase(response: { data?: { session: unknown }; error?: unknown }) {
  const signUp = vi.fn().mockResolvedValue({ data: response.data ?? { session: null }, error: response.error ?? null });
  return { client: { auth: { signUp } } as unknown as SupabaseClient, signUp };
}

describe("signUpProfessional", () => {
  it("envia nome e código de convite nos metadados", async () => {
    const { client, signUp } = fakeSupabase({ data: { session: { access_token: "x" } } });
    expect(await signUpProfessional(client, { ...valid, fullName: " Maria Souza " })).toEqual({ ok: true });
    expect(signUp).toHaveBeenCalledWith({
      email: "maria@exemplo.com",
      password: "senha-1234",
      options: { data: { full_name: "Maria Souza", invite_code: "convite-123" } },
    });
  });

  it("dados inválidos nem chegam ao Supabase", async () => {
    const { client, signUp } = fakeSupabase({});
    expect(await signUpProfessional(client, { ...valid, password: "curta" })).toMatchObject({ ok: false, kind: "validation" });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("código recusado pelo banco", async () => {
    const { client } = fakeSupabase({ error: { status: 500, code: "unexpected_failure", message: "Database error saving new user" } });
    expect(await signUpProfessional(client, valid)).toEqual({ ok: false, kind: "invite", error: "Código de convite inválido." });
  });

  it("sem sessão (confirmação de e-mail ligada) avisa a administradora", async () => {
    const { client } = fakeSupabase({ data: { session: null } });
    expect(await signUpProfessional(client, valid)).toMatchObject({ ok: false, kind: "confirm-email" });
  });
});
