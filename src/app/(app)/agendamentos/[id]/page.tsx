import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";
import { StatusActions } from "@/components/appointments/status-actions";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfessional } from "@/lib/auth/session";
import { getAppointment } from "@/lib/data/appointments";
import { formatDuration } from "@/lib/datetime";
import { formatBRL } from "@/lib/money";
import { formatBrazilPhone } from "@/lib/phone";
import { agendaHref } from "@/lib/agenda-url";
import { isOpenStatus } from "@/lib/appointments/transitions";
import { formatLongDateCapitalized, formatTime, toZonedParts } from "@/lib/timezone";
import { buildConfirmationMessage } from "@/lib/whatsapp-message";

export const metadata: Metadata = { title: "Atendimento" };

export default function AppointmentPage({ params }: PageProps<"/agendamentos/[id]">) {
  return (
    <Suspense fallback={<div className="p-5 text-sm text-taupe-soft">Carregando...</div>}>
      <Appointment params={params} />
    </Suspense>
  );
}

async function Appointment({ params }: { params: PageProps<"/agendamentos/[id]">["params"] }) {
  const me = await getCurrentProfessional();
  if (!me) redirect("/auth/acesso-negado");

  const { id } = await params;
  const item = await getAppointment(id);
  if (!item) notFound();

  const date = toZonedParts(item.start_at).date;
  const mine = item.professional_id === me.professionalId;
  const open = isOpenStatus(item.status);
  const editable = mine && open;
  const clientName = item.clients?.full_name ?? "Cliente";
  // a mensagem de confirmação só faz sentido enquanto o atendimento ainda vai acontecer
  const message = !open
    ? undefined
    : buildConfirmationMessage({
        clientName,
        startAt: item.start_at,
        serviceName: item.services?.name ?? "Serviço",
        professionalName: item.professionals?.display_name ?? "",
      });

  return (
    <>
      <PageHeader title={clientName} backHref={agendaHref({ date })} backLabel="Agenda" />
      <div className="space-y-5 px-5">
        <section aria-label="Atendimento" className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <StatusBadge status={item.status} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.95rem]">
            <dt className="text-taupe-soft">Data</dt>
            <dd className="text-right font-medium text-cocoa">{formatLongDateCapitalized(date)}</dd>
            <dt className="text-taupe-soft">Horário</dt>
            <dd className="text-right font-medium tabular-nums text-cocoa">
              {formatTime(item.start_at)} – {formatTime(item.end_at)} ({formatDuration(item.duration_minutes_at_booking)})
            </dd>
            <dt className="text-taupe-soft">Serviço</dt>
            <dd className="text-right font-medium text-cocoa">{item.services?.name ?? "—"}</dd>
            <dt className="text-taupe-soft">Profissional</dt>
            <dd className="text-right font-medium text-cocoa">{item.professionals?.display_name ?? "—"}</dd>
            <dt className="text-taupe-soft">Preço</dt>
            <dd className="text-right font-medium text-cocoa">{formatBRL(item.price_at_booking)}</dd>
            <dt className="text-taupe-soft">Cliente</dt>
            <dd className="text-right font-medium text-cocoa">
              {item.clients ? (
                <Link href={`/clientes/${item.clients.id}`} className="inline-flex min-h-11 items-center underline">
                  {clientName}
                </Link>
              ) : (
                "—"
              )}
            </dd>
            {item.clients && (
              <>
                <dt className="text-taupe-soft">Telefone</dt>
                <dd className="text-right font-medium text-cocoa">{formatBrazilPhone(item.clients.phone)}</dd>
              </>
            )}
          </dl>
          {item.notes && <p className="whitespace-pre-line border-t border-border pt-3 text-[0.95rem] text-taupe-soft">{item.notes}</p>}
        </section>

        <div className="flex flex-col gap-3">
          {item.clients && (
            <WhatsAppLink
              phone={item.clients.phone}
              name={clientName}
              message={message}
              label={message ? "Enviar confirmação no WhatsApp" : "Abrir WhatsApp"}
              variant="button"
              className="w-full"
            />
          )}
          {message && (
            <p className="-mt-1 text-sm text-taupe-soft">
              Abrir o WhatsApp não muda o status. Depois que a cliente responder, toque em Confirmar atendimento.
            </p>
          )}
          {mine && (
            <StatusActions
              appointmentId={item.id}
              status={item.status}
              clientName={clientName}
              variant="detail"
              afterCancelHref={agendaHref({ date, cancelled: true })}
            />
          )}
          {editable && (
            <Link href={`/agendamentos/${item.id}/editar`} className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}>
              <Pencil aria-hidden />
              Editar ou remarcar
            </Link>
          )}
          {!mine && (
            <p className="rounded-xl bg-muted px-4 py-3 text-sm text-taupe-soft">
              Este atendimento é de {item.professionals?.display_name ?? "outra profissional"}. Você pode consultá-lo, mas só ela pode alterá-lo.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
