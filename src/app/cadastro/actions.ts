"use server";

import { cookies } from "next/headers";
import { signUpProfessional } from "@/lib/auth/signup";
import { SIGNUP_MESSAGES } from "@/lib/auth/signup-errors";
import { REMEMBER_COOKIE, REMEMBER_MAX_AGE } from "@/lib/supabase/cookies";
import { createClient } from "@/lib/supabase/server";

export type SignupActionResult = { ok: true } | { ok: false; error: string };

/** Cria a conta e já entra (sessão lembrada neste aparelho, como o padrão do login). */
export async function signup(values: unknown): Promise<SignupActionResult> {
  const cookieStore = await cookies();
  cookieStore.set(REMEMBER_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REMEMBER_MAX_AGE,
  });

  try {
    const supabase = await createClient({ remember: true });
    const result = await signUpProfessional(supabase, values);
    if (!result.ok) {
      // só o tipo vai para o log do servidor, sem e-mail, nome nem código
      if (result.kind !== "invite" && result.kind !== "exists" && result.kind !== "validation") console.error("[cadastro] falha", { kind: result.kind });
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } catch (e) {
    console.error("[cadastro] exceção", e instanceof Error ? e.message : "desconhecida");
    return { ok: false, error: SIGNUP_MESSAGES.network };
  }
}
