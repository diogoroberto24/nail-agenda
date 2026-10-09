import type { Metadata } from "next";
import { ClientForm } from "@/components/clients/client-form";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Nova cliente" };

export default function NewClientPage() {
  return (
    <>
      <PageHeader title="Nova cliente" backHref="/clientes" backLabel="Clientes" />
      <ClientForm cancelHref="/clientes" />
    </>
  );
}
