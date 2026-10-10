"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginErrorMessage } from "@/lib/auth/login-errors";
import { loginSchema, type LoginValues } from "@/lib/auth/schemas";
import { REMEMBER_COOKIE, REMEMBER_MAX_AGE } from "@/lib/supabase/cookies";
import { createClient } from "@/lib/supabase/server";

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(values: LoginValues): Promise<LoginResult> {
  // a validação do navegador não basta: revalida no servidor
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Confira o e-mail e a senha." };
  }
  const { email, password, remember } = parsed.data;

  const cookieStore = await cookies();
  cookieStore.set(REMEMBER_COOKIE, remember ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // sem "lembrar de mim", o próprio marcador também some ao fechar o navegador
    ...(remember ? { maxAge: REMEMBER_MAX_AGE } : {}),
  });

  try {
    const supabase = await createClient({ remember });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const { kind, message } = loginErrorMessage(error);
      // erros que NÃO são senha errada (chave inválida, rede, limite) vão para o log do servidor, sem dados pessoais
      if (kind !== "credentials") console.error("[login] falha de autenticação", { kind, status: error.status, code: error.code });
      return { ok: false, error: message };
    }
  } catch (e) {
    console.error("[login] exceção ao autenticar", e instanceof Error ? e.message : "desconhecida");
    return { ok: false, error: "Sem conexão com o servidor. Verifique a internet e tente de novo." };
  }

  return { ok: true };
}

/** Sai só deste aparelho; as sessões em outros aparelhos continuam ("lembrar de mim neste aparelho"). */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
