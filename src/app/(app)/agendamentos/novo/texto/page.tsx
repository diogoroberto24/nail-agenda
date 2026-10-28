import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { TextBooking } from "@/components/appointments/wizard/text-booking";
import { getCurrentProfessional } from "@/lib/auth/session";
import { isAiConfigured } from "@/lib/ai/model";

export const metadata: Metadata = { title: "Agendar por texto" };

/**
 * Agendar por texto (IA). Fica dentro do layout do novo agendamento, então usa o mesmo rascunho:
 * a sugestão da IA preenche as etapas e a confirmação acontece no resumo de sempre.
 * Sem chave de IA configurada, a rota leva ao passo a passo normal.
 */
export default function TextBookingPage() {
  return (
    <Suspense fallback={<div className="p-5 text-sm text-taupe-soft">Carregando...</div>}>
      <TextBookingData />
    </Suspense>
  );
}

async function TextBookingData() {
  const me = await getCurrentProfessional();
  if (!me) redirect("/auth/acesso-negado");
  if (!isAiConfigured()) redirect("/agendamentos/novo");

  return (
    <>
      <PageHeader
        title="Agendar por texto"
        description="Escreva como falaria: a IA preenche o agendamento e você confere antes de salvar."
        backHref="/agendamentos/novo/cliente"
        backLabel="Passo a passo"
      />
      <TextBooking />
    </>
  );
}
