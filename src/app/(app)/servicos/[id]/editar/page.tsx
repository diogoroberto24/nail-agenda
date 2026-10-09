import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ServiceForm } from "@/components/services/service-form";
import { getCurrentProfessional } from "@/lib/auth/session";
import { getService } from "@/lib/data/services";
import { formatPriceInput } from "@/lib/money";

export const metadata: Metadata = { title: "Editar serviço" };

export default function EditServicePage({ params }: PageProps<"/servicos/[id]/editar">) {
  return (
    <Suspense fallback={<div className="p-5 text-sm text-taupe-soft">Carregando...</div>}>
      <EditService params={params} />
    </Suspense>
  );
}

async function EditService({ params }: { params: PageProps<"/servicos/[id]/editar">["params"] }) {
  const me = await getCurrentProfessional();
  if (!me) redirect("/auth/acesso-negado");
  const { id } = await params;
  const service = await getService(id);
  // só a dona edita o serviço (a colega pode ver, mas não alterar)
  if (!service || service.professional_id !== me.professionalId) notFound();

  return (
    <>
      <PageHeader title="Editar serviço" backHref="/servicos" backLabel="Serviços" />
      <ServiceForm
        serviceId={service.id}
        cancelHref="/servicos"
        defaultValues={{
          name: service.name,
          description: service.description ?? "",
          durationMinutes: String(service.default_duration_minutes),
          price: formatPriceInput(service.default_price),
        }}
      />
    </>
  );
}
