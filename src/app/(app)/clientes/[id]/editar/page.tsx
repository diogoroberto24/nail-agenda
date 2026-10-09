import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/clients/client-form";
import { PageHeader } from "@/components/page-header";
import { getClient } from "@/lib/data/clients";
import { formatBrazilPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Editar cliente" };

export default function EditClientPage({ params }: PageProps<"/clientes/[id]/editar">) {
  return (
    <Suspense fallback={<div className="p-5 text-sm text-taupe-soft">Carregando...</div>}>
      <EditClient params={params} />
    </Suspense>
  );
}

async function EditClient({ params }: { params: PageProps<"/clientes/[id]/editar">["params"] }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  return (
    <>
      <PageHeader title="Editar cliente" backHref={`/clientes/${client.id}`} backLabel={client.full_name} />
      <ClientForm
        clientId={client.id}
        cancelHref={`/clientes/${client.id}`}
        defaultValues={{
          fullName: client.full_name,
          phone: formatBrazilPhone(client.phone),
          notes: client.notes ?? "",
        }}
      />
    </>
  );
}
