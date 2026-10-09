import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Conta autenticada, mas sem vínculo com um salão: encerra a sessão e volta ao login. */
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login?erro=sem-acesso", request.url));
}
