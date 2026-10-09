import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Serviços" };

export default function Page() {
  return (
    <>
      <PageHeader title="Serviços" description="Seus serviços, preços e durações." backHref="/menu" backLabel="Menu" />
      <EmptyState
        icon={Sparkles}
        title="Serviços em preparação"
        description="Aqui você vai cadastrar os serviços que oferece."
      />
    </>
  );
}
