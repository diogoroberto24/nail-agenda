import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RecurrenceForm } from "@/components/recurrence/recurrence-form";
import { getCurrentProfessional } from "@/lib/auth/session";
import { getRecurrence } from "@/lib/data/recurrences";
import { listServicesOf } from "@/lib/data/services";
import { formatPriceInput } from "@/lib/money";
import { horizonEnd, occurrenceDates } from "@/lib/recurrence/rules";
import { ruleOf } from "@/lib/recurrence/service";
import { todayInZone } from "@/lib/timezone";

export const metadata: Metadata = { title: "Alterar recorrência" };

export default function ChangeRecurrencePage({ params }: PageProps<"/recorrencias/[id]/alterar">) {
  return (
    <Suspense fallback={<div className="p-5 text-sm text-taupe-soft">Carregando...</div>}>
      <ChangeRecurrence params={params} />
    </Suspense>
  );
}

async function ChangeRecurrence({ params }: { params: PageProps<"/recorrencias/[id]/alterar">["params"] }) {
  await connection();
  const me = await getCurrentProfessional();
  if (!me) redirect("/auth/acesso-negado");
  const { id } = await params;
  const rec = await getRecurrence(id);
  if (!rec || rec.ended_at || !rec.clients) notFound();

  const today = todayInZone();
  // sugere começar na próxima data da regra
  const next = occurrenceDates(ruleOf(rec), { from: today, until: horizonEnd(today) })[0] ?? today;
  const services = (await listServicesOf(me.professionalId))
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name, durationMinutes: s.default_duration_minutes, price: Number(s.default_price) }));

  return (
    <>
      <PageHeader title="Alterar recorrência" description="A mudança vale a partir da data escolhida." backHref={`/recorrencias/${rec.id}`} backLabel="Recorrência" />
      <RecurrenceForm
        clientId={rec.client_id}
        clientName={rec.clients.full_name}
        services={services}
        changeOfId={rec.id}
        defaultValues={{
          clientId: rec.client_id,
          serviceId: rec.service_id,
          frequency: rec.frequency,
          intervalDays: rec.interval_days ? String(rec.interval_days) : "",
          startDate: next,
          time: rec.start_time.slice(0, 5),
          durationMinutes: String(rec.duration_minutes),
          price: formatPriceInput(Number(rec.price)),
          notes: rec.notes ?? "",
          endDate: rec.end_date ?? "",
        }}
        doneHref={`/clientes/${rec.client_id}`}
        cancelHref={`/recorrencias/${rec.id}`}
      />
    </>
  );
}
