import type { CookieOptions } from "@supabase/ssr";

/** Cookie que guarda a escolha "lembrar de mim" feita no login. */
export const REMEMBER_COOKIE = "na-remember";

/** 30 dias; usado só para o cookie da própria escolha, não para a sessão do Supabase. */
export const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Sem "lembrar de mim", os cookies de sessão do Supabase viram cookies de sessão
 * do navegador (sem maxAge/expires) e somem quando o navegador é fechado.
 */
export function applyRemember(options: CookieOptions, remember: boolean): CookieOptions {
  if (remember) return options;
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}

/** Ausência do cookie conta como "lembrar" (padrão confortável no celular). */
export function shouldRemember(value: string | undefined): boolean {
  return value !== "0";
}
