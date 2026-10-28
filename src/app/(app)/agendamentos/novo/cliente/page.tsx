import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ClientStep } from "@/components/appointments/wizard/client-step";
import { getCurrentProfessional } from "@/lib/auth/session";
import { isAiConfigured } from "@/lib/ai/model";
import { listRecentClients, searchActiveClients } from "@/lib/data/appointments";
import { formatBrazilPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Novo agendamento: cliente" };

export default function ClientStepPage() {
  return (
    <Suspense fallback={<div className="px-5 text-sm text-taupe-soft">Carregando...</div>}>
      <ClientStepData />
    </Suspense>
  );
}

async function ClientStepData() {
  const me = await getCurrentProfessional();
  if (!me) redirect("/auth/acesso-negado");

  // "Clientes recentes": as últimas que a profissional agendou; sem nenhuma, as primeiras em ordem alfabética
  let recent = true;
  let clients = await listRecentClients(me.professionalId, 4);
  if (clients.length === 0) {
    recent = false;
    clients = (await searchActiveClients("", 4)).map((c) => ({ id: c.id, fullName: c.full_name, phone: c.phone }));
  }

  return (
    <ClientStep
      recent={recent}
      aiEnabled={isAiConfigured()}
      initialClients={clients.map((c) => ({ id: c.id, fullName: c.fullName, phone: formatBrazilPhone(c.phone) }))}
    />
  );
}
