import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { AppointmentForm, type ServiceOption } from "@/components/appointments/appointment-form";
import { PageHeader } from "@/components/page-header";
import { getCurrentProfessional } from "@/lib/auth/session";
import { getAppointment } from "@/lib/data/appointments";
import { listServicesOf } from "@/lib/data/services";
import { formatPriceInput } from "@/lib/money";
import { formatBrazilPhone } from "@/lib/phone";
import { toZonedParts } from "@/lib/timezone";

export const metadata: Metadata = { title: "Editar atendimento" };

export default function EditAppointmentPage({ params }: PageProps<"/agendamentos/[id]/editar">) {
  return (
    <Suspense fallback={<div className="p-5 text-sm text-taupe-soft">Carregando...</div>}>
      <EditAppointment params={params} />
    </Suspense>
  );
}

async function EditAppointment({ params }: { params: PageProps<"/agendamentos/[id]/editar">["params"] }) {
  const me = await getCurrentProfessional();
  if (!me) redirect("/auth/acesso-negado");

  const { id } = await params;
  const appointment = await getAppointment(id);
  // só a dona edita; atendimentos concluídos, cancelados ou com falta ficam como estão
  if (!appointment || appointment.professional_id !== me.professionalId) notFound();
  if (appointment.status !== "awaiting_confirmation" && appointment.status !== "confirmed") {
    redirect(`/agendamentos/${appointment.id}`);
  }

  const start = toZonedParts(appointment.start_at);
  // o serviço atual continua escolhível mesmo se tiver sido desativado depois
  const services: ServiceOption[] = (await listServicesOf(me.professionalId))
    .filter((s) => s.active || s.id === appointment.service_id)
    .map((s) => ({
      id: s.id,
      name: s.name,
      durationMinutes: s.default_duration_minutes,
      price: Number(s.default_price),
      active: s.active,
    }));

  return (
    <>
      <PageHeader title="Editar atendimento" backHref={`/agendamentos/${appointment.id}`} backLabel="Detalhes" />
      <AppointmentForm
        appointmentId={appointment.id}
        professionalName={me.displayName}
        services={services}
        initialClient={
          appointment.clients
            ? { id: appointment.clients.id, name: appointment.clients.full_name, phone: formatBrazilPhone(appointment.clients.phone) }
            : null
        }
        defaultValues={{
          clientId: appointment.client_id,
          serviceId: appointment.service_id,
          date: start.date,
          time: start.time,
          durationMinutes: String(appointment.duration_minutes_at_booking),
          price: formatPriceInput(appointment.price_at_booking),
          notes: appointment.notes ?? "",
        }}
        cancelHref={`/agendamentos/${appointment.id}`}
      />
    </>
  );
}
