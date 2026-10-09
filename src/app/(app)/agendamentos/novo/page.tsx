import type { Metadata } from "next";
import { CalendarPlus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Novo agendamento" };

export default function Page() {
  return (
    <>
      <PageHeader title="Novo agendamento" description="Marque um atendimento." backHref="/agenda" backLabel="Agenda" />
      <EmptyState
        icon={CalendarPlus}
        title="Formulário em preparação"
        description="Aqui você vai escolher cliente, serviço, data e horário."
      />
    </>
  );
}
