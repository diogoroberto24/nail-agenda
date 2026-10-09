import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applyRemember, REMEMBER_COOKIE, shouldRemember } from "./cookies";
import { getSupabaseEnv } from "./env";

/** Rotas acessíveis sem login. */
const PUBLIC_PATHS = ["/login"];

/**
 * Renova a sessão do Supabase e faz a verificação otimista de acesso:
 * sem sessão → /login; com sessão em /login → /.
 * A autorização de verdade acontece no servidor, em cada página/ação (ver lib/auth/session.ts).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseEnv();
  const remember = shouldRemember(request.cookies.get(REMEMBER_COOKIE)?.value);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, applyRemember(options, remember)),
        );
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // getClaims valida a assinatura do token; não use getSession() no servidor.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!isAuthenticated && !isPublic) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    // preserva cookies renovados (ex.: limpeza de sessão inválida)
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  if (isAuthenticated && isPublic) {
    const redirect = NextResponse.redirect(new URL("/", request.url));
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}
