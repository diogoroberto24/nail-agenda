"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CircleCheck, Plus } from "lucide-react";
import { useDraft } from "@/components/appointments/wizard/draft-context";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { endOf } from "@/lib/appointments/slots";
import { WIZARD_BASE } from "@/lib/appointments/wizard";
import { agendaHref } from "@/lib/agenda-url";
import { formatBRL } from "@/lib/money";
import { normalizeBrazilPhone } from "@/lib/phone";
import { formatLongDateCapitalized, zonedDateTimeToUtc } from "@/lib/timezone";
import { buildConfirmationMessage } from "@/lib/whatsapp-message";

/** Tela final: "Agendamento realizado!", com o resumo e os próximos passos. */
export function SuccessScreen() {
  const router = useRouter();
  const { saved, professionalName } = useDraft();

  // sem atendimento recém-criado (ex.: página recarregada), não há o que mostrar
  useEffect(() => {
    if (!saved) router.replace("/agenda");
  }, [saved, router]);

  if (!saved) return <div className="px-5 pt-6 text-sm text-taupe-soft">Carregando...</div>;

  const end = endOf(saved.date, saved.time, saved.durationMinutes);
  const phone = normalizeBrazilPhone(saved.clientPhone) ?? "";
  const message = buildConfirmationMessage({
    clientName: saved.clientName,
    startAt: zonedDateTimeToUtc(saved.date, saved.time),
    serviceName: saved.serviceName,
    professionalName,
  });

  const summary: [string, string][] = [
    ["Cliente", saved.clientName],
    ["Serviço", saved.serviceName],
    ["Data", formatLongDateCapitalized(saved.date)],
    ["Horário", `${saved.time} – ${end.time}${end.nextDay ? " (dia seguinte)" : ""}`],
    ["Profissional", professionalName],
    ["Valor", formatBRL(saved.price)],
  ];

  return (
    <div className="space-y-6 px-5 pt-8">
      <div className="space-y-3 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#e4ede5] text-[#2f5a3a]">
          <CircleCheck className="size-9" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold text-cocoa">Agendamento realizado!</h1>
        <p className="text-[0.95rem] text-taupe-soft">O atendimento foi salvo como aguardando confirmação.</p>
      </div>

      <section aria-label="Resumo do agendamento" className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.95rem]">
          {summary.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-taupe-soft">{label}</dt>
              <dd className="text-right font-medium text-cocoa">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-col gap-3">
        <WhatsAppLink
          phone={phone}
          name={saved.clientName}
          message={message}
          label="Enviar confirmação no WhatsApp"
          variant="button"
          className="h-auto min-h-12 w-full py-2 text-center"
        />
        <Link
          href={agendaHref({ date: saved.date, highlight: saved.id })}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cocoa px-4 font-medium text-offwhite active:opacity-90"
        >
          <CalendarDays className="size-5" aria-hidden />
          Ver na agenda
        </Link>
        <Link
          href={WIZARD_BASE}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 font-medium text-cocoa active:bg-muted"
        >
          <Plus className="size-5" aria-hidden />
          Novo agendamento
        </Link>
      </div>
    </div>
  );
}
