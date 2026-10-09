import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/data/clients";

export type ServiceRow = {
  id: string;
  professional_id: string;
  name: string;
  description: string | null;
  default_duration_minutes: number;
  default_price: string | number;
  active: boolean;
};

const SERVICE_COLUMNS = "id, professional_id, name, description, default_duration_minutes, default_price, active";

/** Serviços de uma profissional: ativos primeiro, depois por nome. */
export async function listServicesOf(professionalId: string): Promise<ServiceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_COLUMNS)
    .eq("professional_id", professionalId)
    .limit(500);
  if (error) throw new Error("Não foi possível carregar os serviços.");
  return (data ?? []).sort(
    (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
  );
}

export async function getService(id: string): Promise<ServiceRow | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("services").select(SERVICE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar o serviço.");
  return data;
}
