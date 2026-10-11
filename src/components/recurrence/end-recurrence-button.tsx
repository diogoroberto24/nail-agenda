"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleOff, LoaderCircle } from "lucide-react";
import { endRecurrenceAction } from "@/app/(app)/recorrencias/actions";
import { Button } from "@/components/ui/button";

type Props = {
  recurrenceId: string;
  clientId: string;
  /** permite injetar a ação nos testes */
  endAction?: typeof endRecurrenceAction;
};

/** Encerrar pede uma confirmação na própria tela (sem janela). Cancela os futuros que ainda aguardam confirmação. */
export function EndRecurrenceButton({ recurrenceId, clientId, endAction = endRecurrenceAction }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await endAction(recurrenceId, clientId);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        router.push(`/clientes/${clientId}?recorrencia=encerrada&n=${r.cancelled}&k=${r.kept}`);
      } catch {
        setError("Não foi possível encerrar. Verifique a conexão e tente de novo.");
      }
    });
  }

  if (!confirming) {
    return (
      <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => setConfirming(true)}>
        <CircleOff aria-hidden />
        Encerrar recorrência
      </Button>
    );
  }
  return (
    <div role="alertdialog" aria-label="Confirmar encerramento" className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-cocoa">
        Os próximos atendimentos que ainda aguardam confirmação serão cancelados e nenhum novo será criado. Os já confirmados ficam como estão.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button type="button" variant="outline" size="lg" className="flex-1" disabled={isPending} onClick={() => setConfirming(false)}>
          Voltar
        </Button>
        <Button type="button" size="lg" className="flex-1" disabled={isPending} onClick={run}>
          {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          Encerrar
        </Button>
      </div>
    </div>
  );
}
