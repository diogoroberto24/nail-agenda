/**
 * Traduz um erro do Supabase Auth em mensagem para a tela.
 *
 * Só o código `invalid_credentials` significa e-mail ou senha errados. Outros 4xx (como 401 "Invalid API key",
 * quando a chave configurada no servidor está errada) são problema de CONFIGURAÇÃO e não podem aparecer como
 * "senha incorreta", senão a pessoa fica tentando senhas certas sem sucesso.
 */
export type AuthFailure = { status?: number; code?: string };

export type LoginErrorKind = "credentials" | "rate-limit" | "config" | "network" | "unknown";

export function classifyAuthError(error: AuthFailure): LoginErrorKind {
  if (error.code === "invalid_credentials") return "credentials";
  if (error.status === 429 || error.code === "over_request_rate_limit") return "rate-limit";
  if (error.status === 401 || error.status === 403 || error.status === 404) return "config";
  if (!error.status) return "network";
  return "unknown";
}

export const LOGIN_MESSAGES: Record<LoginErrorKind, string> = {
  credentials: "E-mail ou senha incorretos.",
  "rate-limit": "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  config: "O servidor não conseguiu validar o acesso agora. Avise a administradora do sistema.",
  network: "Não foi possível entrar agora. Verifique a internet e tente de novo.",
  unknown: "Não foi possível entrar agora. Tente de novo em instantes.",
};

/** Mensagem para o usuário + tipo (para registrar no log do servidor, sem dados pessoais). */
export function loginErrorMessage(error: AuthFailure): { kind: LoginErrorKind; message: string } {
  const kind = classifyAuthError(error);
  return { kind, message: LOGIN_MESSAGES[kind] };
}
