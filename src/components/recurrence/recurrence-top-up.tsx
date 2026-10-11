"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { topUpRecurrencesAction } from "@/app/(app)/recorrencias/actions";

/**
 * Ao abrir o app, repõe os atendimentos das recorrências até 6 meses à frente (só as da profissional logada).
 * Roda no máximo uma vez por dia por aparelho; é idempotente no servidor, então abrir em dois aparelhos não duplica.
 * Não mostra nada na tela.
 */
export function RecurrenceTopUp({ action = topUpRecurrencesAction }: { action?: typeof topUpRecurrencesAction }) {
  const router = useRouter();

  useEffect(() => {
    const day = new Date().toISOString().slice(0, 10);
    const key = `na-recorrencia-${day}`;
    try {
      if (window.localStorage.getItem(key)) return;
    } catch {
      // sem armazenamento: roda mesmo assim (o servidor é idempotente)
    }
    let cancelled = false;
    action()
      .then((r) => {
        if (cancelled) return;
        try {
          window.localStorage.setItem(key, "1");
        } catch {
          // ignorado
        }
        if (r.created > 0) router.refresh();
      })
      .catch(() => {
        // tenta de novo na próxima abertura
      });
    return () => {
      cancelled = true;
    };
  }, [action, router]);

  return null;
}
