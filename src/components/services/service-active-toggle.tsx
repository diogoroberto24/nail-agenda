"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Power, PowerOff } from "lucide-react";
import { setServiceActiveAction } from "@/app/(app)/servicos/actions";
import { cn } from "@/lib/utils";

/** Desativa/reativa um serviço. Serviço inativo some dos novos agendamentos, mas continua no histórico. */
export function ServiceActiveToggle({ serviceId, active, name }: { serviceId: string; active: boolean; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await setServiceActiveAction(serviceId, !active);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      } catch {
        setError("Sem conexão. Tente de novo.");
      }
    });
  }

  const Icon = isPending ? LoaderCircle : active ? PowerOff : Power;
  return (
    <div className="flex shrink-0 flex-col items-center">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-label={`${active ? "Desativar" : "Reativar"} ${name}`}
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full active:bg-muted disabled:opacity-60",
          active ? "text-taupe-soft" : "text-rose-deep",
        )}
      >
        <Icon className={cn("size-5", isPending && "animate-spin")} strokeWidth={1.7} aria-hidden />
      </button>
      {error && (
        <span role="alert" className="max-w-24 text-center text-[0.7rem] leading-tight text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
