import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Configurações" };

export default function Page() {
  return (
    <>
      <PageHeader title="Configurações" description="Preferências do aplicativo." backHref="/menu" backLabel="Menu" />
      <EmptyState
        icon={Settings}
        title="Configurações em preparação"
        description="Aqui ficarão as preferências do aplicativo."
      />
    </>
  );
}
