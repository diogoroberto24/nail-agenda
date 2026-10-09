import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentProfessional = {
  userId: string;
  email: string | undefined;
  professionalId: string;
  salonId: string;
  displayName: string;
};

/**
 * Profissional logada, ou null se não houver sessão válida OU se a conta
 * existir mas não for membro/profissional ativa de um salão.
 *
 * É a verificação de autorização real (o proxy faz só uma checagem otimista).
 * Use em toda página, Server Action e rota que leia ou grave dados.
 */
export const getCurrentProfessional = cache(async (): Promise<CurrentProfessional | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  // RLS já limita a consulta ao salão da usuária; filtramos pela própria linha.
  const { data: professional } = await supabase
    .from("professionals")
    .select("id, salon_id, display_name")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (!professional) return null;

  return {
    userId,
    email: typeof data?.claims?.email === "string" ? data.claims.email : undefined,
    professionalId: professional.id,
    salonId: professional.salon_id,
    displayName: professional.display_name,
  };
});
