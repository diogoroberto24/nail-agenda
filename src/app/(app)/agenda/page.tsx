import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Agenda" };

export default function Page() {
  return (
    <>
      <PageHeader title="Agenda" description="Atendimentos do salão." />
      <EmptyState
        icon={CalendarDays}
        title="Agenda em preparação"
        description="Aqui você vai consultar os atendimentos do dia e os horários livres."
      />
    </>
  );
}
