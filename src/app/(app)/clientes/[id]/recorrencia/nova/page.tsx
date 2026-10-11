import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RecurrenceForm } from "@/components/recurrence/recurrence-form";
import { getCurrentProfessional } from "@/lib/auth/session";
import { getClient } from "@/lib/data/clients";
import { listServicesOf } from "@/lib/data/services";

export const metadata: Metadata = { title: "Nova recorrência" };

export default function NewRecurrencePage({ params }: PageProps<"/clientes/[id]/recorrencia/nova">) {
  return (
    <Suspense fallback={<div className="p-5 text-sm text-taupe-soft">Carregando...</div>}>
      <NewRecurrence params={params} />
    </Suspense>
  );
}

async function NewRecurrence({ params }: { params: PageProps<"/clientes/[id]/recorrencia/nova">["params"] }) {
  const me = await getCurrentProfessional();
  if (!me) redirect("/auth/acesso-negado");
  const { id } = await params;
  const client = await getClient(id);
  if (!client || client.archived_at) notFound();

  const services = (await listServicesOf(me.professionalId))
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name, durationMinutes: s.default_duration_minutes, price: Number(s.default_price) }));

  return (
    <>
      <PageHeader
        title="Nova recorrência"
        description="Repete o atendimento e já reserva os horários dos próximos 6 meses."
        backHref={`/clientes/${client.id}`}
        backLabel={client.full_name}
      />
      <RecurrenceForm
        clientId={client.id}
        clientName={client.full_name}
        services={services}
        defaultValues={{ clientId: client.id }}
        doneHref={`/clientes/${client.id}`}
        cancelHref={`/clientes/${client.id}`}
      />
    </>
  );
}
