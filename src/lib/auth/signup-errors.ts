/**
 * Traduz um erro do Supabase Auth no cadastro em mensagem para a tela.
 *
 * O código de convite é conferido por um trigger no banco. Quando ele recusa, o Supabase devolve só
 * "Database error saving new user" (sem dizer o motivo): como o nome e o e-mail já foram validados antes,
 * esse é, na prática, "código de convite inválido".
 */
export type SignupFailure = { status?: number; code?: string; message?: string };

export type SignupErrorKind = "invite" | "exists" | "weak-password" | "invalid-email" | "rate-limit" | "disabled" | "network" | "unknown";

export function classifySignupError(error: SignupFailure): SignupErrorKind {
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "user_already_exists" || error.code === "email_exists" || message.includes("already registered")) return "exists";
  if (error.code === "weak_password") return "weak-password";
  if (error.code === "email_address_invalid" || error.code === "validation_failed") return "invalid-email";
  if (error.status === 429 || error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit") return "rate-limit";
  if (error.code === "signup_disabled") return "disabled";
  if (message.includes("database error saving new user") || error.code === "unexpected_failure") return "invite";
  if (!error.status) return "network";
  return "unknown";
}

export const SIGNUP_MESSAGES: Record<SignupErrorKind, string> = {
  invite: "Código de convite inválido.",
  exists: "Este e-mail já tem cadastro. Volte e entre com a sua senha.",
  "weak-password": "A senha é muito fraca. Use pelo menos 8 caracteres, misturando letras e números.",
  "invalid-email": "Confira o e-mail informado.",
  "rate-limit": "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  disabled: "Os cadastros estão desativados no momento. Avise a administradora do sistema.",
  network: "Não foi possível criar a conta agora. Verifique a internet e tente de novo.",
  unknown: "Não foi possível criar a conta agora. Tente de novo em instantes.",
};

export function signupErrorMessage(error: SignupFailure): { kind: SignupErrorKind; message: string } {
  const kind = classifySignupError(error);
  return { kind, message: SIGNUP_MESSAGES[kind] };
}

/** O Supabase está pedindo confirmação de e-mail: o cadastro não devolveu sessão. */
export const CONFIRM_EMAIL_MESSAGE =
  "Conta criada, mas o sistema ainda exige confirmação de e-mail. Avise a administradora do sistema.";
