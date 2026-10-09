import { redirect } from "next/navigation";
import { getCurrentProfessional } from "@/lib/auth/session";

/** Garante, no servidor, que a usuária é uma profissional ativa de um salão. */
export async function AuthGate({ children }: { children: React.ReactNode }) {
  const professional = await getCurrentProfessional();
  if (!professional) redirect("/auth/acesso-negado");
  return <>{children}</>;
}
