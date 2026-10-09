import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppointmentForm, type ServiceOption } from "@/components/appointments/appointment-form";
import { PageHeader } from "@/components/page-header";
import { getCurrentProfessional } from "@/lib/auth/session";
import { getClient } from "@/lib/data/clients";
import { listServicesOf } from "@/lib/data/services";
import { parseDateParam } from "@/lib/agenda-url";
import { formatBrazilPhone } from "@/lib/phone";
import { isValidTimeString, todayInZone } from "@/lib/timezone";

export const metadata: Metadata = { title: "Novo agendamento" };

export default function NewAppointmentPage({ searchParams }: PageProps<"/agendamentos/novo">) {
  return (
    <>
      <PageHeader title="Novo agendamento" backHref="/agenda" backLabel="Agenda" />
      <Suspense fallback={<div className="px-5 text-sm text-taupe-soft">Carregando...</div>}>
        <NewAppointment searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewAppointment({ searchParams }: { searchParams: PageProps<"/agendamentos/novo">["searchParams"] }) {
  const me = await getCurrentProfessional();
  if (!me) redirect("/auth/acesso-negado");

  const params = await searchParams;
  const date = parseDateParam(params.data, todayInZone());
  const hora = typeof params.hora === "string" && isValidTimeString(params.hora) ? params.hora : "";

  // cliente pré-selecionada (vindo da ficha da cliente); ignora arquivadas
  const clienteId = typeof params.clienteId === "string" ? params.clienteId : undefined;
  const preselected = clienteId ? await getClient(clienteId) : null;
  const initialClient =
    preselected && !preselected.archived_at
      ? { id: preselected.id, name: preselected.full_name, phone: formatBrazilPhone(preselected.phone) }
      : null;

  const services: ServiceOption[] = (await listServicesOf(me.professionalId))
    .filter((s) => s.active)
    .map((s) => ({
      id: s.id,
      name: s.name,
      durationMinutes: s.default_duration_minutes,
      price: Number(s.default_price),
      active: true,
    }));

  return (
    <AppointmentForm
      professionalName={me.displayName}
      services={services}
      initialClient={initialClient}
      defaultValues={{ date, time: hora }}
      cancelHref={`/agenda?data=${date}`}
    />
  );
}
