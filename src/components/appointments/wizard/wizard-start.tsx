"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDraft } from "@/components/appointments/wizard/draft-context";
import { stepHref } from "@/lib/appointments/wizard";
import type { SelectedClient } from "@/components/appointments/client-picker";

/**
 * Começa um agendamento novo: zera o rascunho (com uma tentativa nova) e leva à primeira etapa que falta.
 * Roda toda vez que a entrada é mostrada, inclusive quando o Next reaproveita a tela já visitada, para
 * nunca reabrir o fluxo com os dados do agendamento anterior.
 */
export function WizardStart({ date, time, client }: { date: string; time: string; client: SelectedClient | null }) {
  const router = useRouter();
  const { reset } = useDraft();

  useEffect(() => {
    reset({ client, date, time });
    router.replace(stepHref(client ? "servico" : "cliente"));
  }, [reset, router, client, date, time]);

  return <div className="p-5 text-sm text-taupe-soft">Carregando...</div>;
}
