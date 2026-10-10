/**
 * Cadastro de uma nova profissional. Recebe o cliente Supabase (para poder ser testado contra o banco real)
 * e usa só a chave pública: quem decide se a pessoa entra no salão é o trigger do banco, pelo código de convite.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { signupSchema } from "@/lib/auth/schemas";
import { CONFIRM_EMAIL_MESSAGE, signupErrorMessage, type SignupErrorKind } from "@/lib/auth/signup-errors";

export type SignupResult = { ok: true } | { ok: false; kind: SignupErrorKind | "validation" | "confirm-email"; error: string };

export async function signUpProfessional(supabase: SupabaseClient, values: unknown): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(values);
  if (!parsed.success) return { ok: false, kind: "validation", error: "Confira os campos e tente de novo." };
  const { fullName, email, password, inviteCode } = parsed.data;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, invite_code: inviteCode } },
  });
  if (error) {
    const { kind, message } = signupErrorMessage(error);
    return { ok: false, kind, error: message };
  }
  // com a confirmação de e-mail ligada no Supabase não há sessão: o cadastro existe, mas não dá para entrar
  if (!data.session) return { ok: false, kind: "confirm-email", error: CONFIRM_EMAIL_MESSAGE };
  return { ok: true };
}
