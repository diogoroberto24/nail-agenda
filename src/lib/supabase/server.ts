import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { applyRemember, REMEMBER_COOKIE, shouldRemember } from "./cookies";
import { getSupabaseEnv } from "./env";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Crie um novo a cada requisição (ele depende dos cookies daquela requisição).
 */
export async function createClient(options: { remember?: boolean } = {}) {
  // o cliente do Supabase consulta a hora ao ser criado: só pode existir em uma requisição real, nunca na pré-renderização
  await connection();
  const cookieStore = await cookies();
  const { url, key } = getSupabaseEnv();
  const remember = options.remember ?? shouldRemember(cookieStore.get(REMEMBER_COOKIE)?.value);

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, applyRemember(options, remember)),
          );
        } catch {
          // Server Components não podem gravar cookies; o proxy renova a sessão.
        }
      },
    },
  });
}
