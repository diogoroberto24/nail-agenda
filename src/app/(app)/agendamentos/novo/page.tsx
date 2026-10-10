import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { WizardStart } from "@/components/appointments/wizard/wizard-start";
import { parseDateParam } from "@/lib/agenda-url";
import { getClient } from "@/lib/data/clients";
import { formatBrazilPhone } from "@/lib/phone";
import { isValidTimeString, todayInZone } from "@/lib/timezone";

export const metadata: Metadata = { title: "Novo agendamento" };

/**
 * Entrada do fluxo. Lê da URL a data (?data=), o horário (?hora=) e a cliente (?clienteId=), começa um
 * rascunho novo e segue para a primeira etapa que falta (Cliente, ou Serviço se a cliente já veio escolhida).
 */
export default function NewAppointmentEntry({ searchParams }: PageProps<"/agendamentos/novo">) {
  return (
    <Suspense fallback={<div className="p-5 text-sm text-taupe-soft">Carregando...</div>}>
      <Entry searchParams={searchParams} />
    </Suspense>
  );
}

async function Entry({ searchParams }: { searchParams: PageProps<"/agendamentos/novo">["searchParams"] }) {
  // "hoje" depende do momento do pedido: só calcular em requisição real, nunca na pré-renderização
  await connection();
  const params = await searchParams;
  const date = parseDateParam(params.data, todayInZone());
  const time = typeof params.hora === "string" && isValidTimeString(params.hora) ? params.hora : "";

  // cliente já escolhida (vindo da ficha da cliente); arquivadas são ignoradas
  const clienteId = typeof params.clienteId === "string" ? params.clienteId : undefined;
  const found = clienteId ? await getClient(clienteId) : null;
  const client =
    found && !found.archived_at ? { id: found.id, name: found.full_name, phone: formatBrazilPhone(found.phone) } : null;

  return <WizardStart date={date} time={time} client={client} />;
}
