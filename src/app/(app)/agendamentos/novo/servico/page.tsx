import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ServiceStep } from "@/components/appointments/wizard/service-step";
import { getCurrentProfessional } from "@/lib/auth/session";
import { listServicesOf } from "@/lib/data/services";

export const metadata: Metadata = { title: "Novo agendamento: serviço" };

export default function ServiceStepPage() {
  return (
    <Suspense fallback={<div className="px-5 text-sm text-taupe-soft">Carregando...</div>}>
      <ServiceStepData />
    </Suspense>
  );
}

async function ServiceStepData() {
  const me = await getCurrentProfessional();
  if (!me) redirect("/auth/acesso-negado");

  // só os serviços ATIVOS da própria profissional
  const services = (await listServicesOf(me.professionalId))
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name, durationMinutes: s.default_duration_minutes, price: Number(s.default_price) }));

  return <ServiceStep services={services} />;
}
