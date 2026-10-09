import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ServiceForm } from "@/components/services/service-form";

export const metadata: Metadata = { title: "Novo serviço" };

export default function NewServicePage() {
  return (
    <>
      <PageHeader title="Novo serviço" backHref="/servicos" backLabel="Serviços" />
      <ServiceForm cancelHref="/servicos" />
    </>
  );
}
