"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setClientArchivedAction } from "@/app/(app)/clientes/actions";

/** Arquivar pede uma confirmação na própria tela (sem janela). Reativar é direto. Nunca apaga a cliente. */
export function ArchiveButton({ clientId, archived }: { clientId: string; archived: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(nextArchived: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await setClientArchivedAction(clientId, nextArchived);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setConfirming(false);
        router.refresh();
      } catch {
        setError("Não foi possível concluir. Verifique a conexão e tente de novo.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-xl bg-nude px-4 py-3 text-sm text-cocoa">
          {error}
        </p>
      )}

      {archived ? (
        <Button variant="outline" size="lg" className="w-full" disabled={isPending} onClick={() => run(false)}>
          {isPending ? <LoaderCircle className="animate-spin" aria-hidden /> : <ArchiveRestore aria-hidden />}
          Reativar cliente
        </Button>
      ) : confirming ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-cocoa">
            A cliente deixa de aparecer na lista, mas o histórico de atendimentos é mantido. Você pode reativá-la depois.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" disabled={isPending} onClick={() => setConfirming(false)}>
              Voltar
            </Button>
            <Button size="lg" className="flex-1" disabled={isPending} onClick={() => run(true)}>
              {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
              Arquivar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="lg" className="w-full" onClick={() => setConfirming(true)}>
          <Archive aria-hidden />
          Arquivar cliente
        </Button>
      )}
    </div>
  );
}
