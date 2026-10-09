import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Disponibilidade" };

export default function Page() {
  return (
    <>
      <PageHeader title="Disponibilidade" description="Seus dias e horários de trabalho." backHref="/menu" backLabel="Menu" />
      <EmptyState
        icon={Clock}
        title="Disponibilidade em preparação"
        description="Aqui você vai configurar seus horários, pausas e folgas."
      />
    </>
  );
}
