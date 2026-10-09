"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
      if (error.status === 429) {
        return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
      }
      if (error.status === 400 || error.status === 401 || error.status === 422) {
        // mensagem única: não revela se o e-mail existe
        return { ok: false, error: "E-mail ou senha incorretos." };
      }
      // sem status HTTP (rede) ou erro do servidor: não é culpa da senha
      return { ok: false, error: "Não foi possível entrar agora. Verifique a internet e tente de novo." };
    }
  } catch {
    return { ok: false, error: "Sem conexão com o servidor. Verifique a internet e tente de novo." };
  }

  return { ok: true };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
