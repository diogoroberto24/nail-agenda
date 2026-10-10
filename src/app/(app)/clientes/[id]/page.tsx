import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cake, CalendarPlus, CircleCheck, History, Pencil } from "lucide-react";
import { ArchiveButton } from "@/components/clients/archive-button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { buttonVariants } from "@/components/ui/button";
import { birthdayText } from "@/lib/clients/birthday";
import { getClient, getClientHistory } from "@/lib/data/clients";
import { formatDateTime, formatDuration } from "@/lib/datetime";
import { formatBRL } from "@/lib/money";
import { formatBrazilPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Cliente" };

export default function ClientPage({ params, searchParams }: PageProps<"/clientes/[id]">) {
  return (
    <Suspense fallback={<div className="p-5 text-sm text-taupe-soft">Carregando...</div>}>
      <Client params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Client({
  params,
  searchParams,
}: Pick<PageProps<"/clientes/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const saved = (await searchParams).salvo === "1";
  const [client, history] = await Promise.all([getClient(id), getClientHistory(id)]);
  if (!client) notFound();
  const archived = client.archived_at !== null;

  return (
    <>
      <PageHeader title={client.full_name} backHref="/clientes" backLabel="Clientes" />

      <div className="space-y-5 px-5">
        {saved && (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-[#e4ede5] px-4 py-3 text-sm font-medium text-[#2f5a3a]">
            <CircleCheck className="size-4" aria-hidden />
            Cadastro salvo.
          </p>
        )}
        {archived && (
          <p role="status" className="rounded-xl bg-[#efedeb] px-4 py-3 text-sm text-taupe-soft">
            Cliente arquivada. Ela não aparece na lista, mas o histórico foi mantido.
          </p>
        )}

        <section aria-label="Contato" className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-lg font-medium text-cocoa">{formatBrazilPhone(client.phone)}</p>
          {birthdayText(client) && (
            <p className="flex items-center gap-2 text-[0.95rem] text-taupe-soft">
              <Cake className="size-4 text-rose-deep" aria-hidden />
              Aniversário: {birthdayText(client)}
            </p>
          )}
          {client.notes && <p className="whitespace-pre-line text-[0.95rem] text-taupe-soft">{client.notes}</p>}
          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <WhatsAppLink phone={client.phone} name={client.full_name} variant="button" className="sm:flex-1" />
            <Link href={`/clientes/${client.id}/editar`} className={buttonVariants({ variant: "outline", className: "sm:flex-1" })}>
              <Pencil aria-hidden />
              Editar
            </Link>
          </div>
        </section>

        {!archived && (
          <Link
            href={`/agendamentos/novo?clienteId=${client.id}`}
            className={buttonVariants({ size: "lg", className: "w-full" })}
          >
            <CalendarPlus aria-hidden />
            Agendar atendimento
          </Link>
        )}

        <section aria-labelledby="historico" className="space-y-3">
          <h2 id="historico" className="flex items-center gap-2 text-2xl font-semibold text-cocoa">
            <History className="size-5 text-rose-deep" aria-hidden />
            Histórico
          </h2>
          {history.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-input bg-card px-4 py-6 text-center text-[0.95rem] text-taupe-soft">
              Nenhum atendimento ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              {history.map((a) => (
                <li key={a.id} className="space-y-1.5 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-cocoa">{formatDateTime(a.start_at)}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="text-[0.95rem] text-cocoa">{a.services?.name ?? "Serviço"}</p>
                  <p className="text-sm text-taupe-soft">
                    {a.professionals?.display_name ?? "Profissional"} · {formatDuration(a.duration_minutes_at_booking)} ·{" "}
                    {formatBRL(a.price_at_booking)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ArchiveButton clientId={client.id} archived={archived} />
      </div>
    </>
  );
}
