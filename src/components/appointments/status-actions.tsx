"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, CheckCheck, ChevronDown, LoaderCircle, RotateCcw, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setAppointmentStatusAction } from "@/app/(app)/agendamentos/actions";
import { canTransition, isReopen } from "@/lib/appointments/transitions";
import { type AppointmentStatus } from "@/lib/appointments/status";
import { cn } from "@/lib/utils";

type StatusActionsProps = {
  appointmentId: string;
  status: AppointmentStatus;
  clientName: string;
  /** "card": ação principal + menu "Mais"; "detail": todas as ações visíveis */
  variant: "card" | "detail";
  /** para onde ir depois de cancelar (o atendimento sai da agenda) */
  afterCancelHref: string;
  /** permite injetar a ação nos testes */
  setStatus?: typeof setAppointmentStatusAction;
};

type Option = { next: AppointmentStatus; label: string; icon: typeof Check };

const OPTIONS: Option[] = [
  { next: "confirmed", label: "Confirmar atendimento", icon: Check },
  { next: "completed", label: "Concluir atendimento", icon: CheckCheck },
  { next: "no_show", label: "Não compareceu", icon: UserX },
  { next: "cancelled", label: "Cancelar agendamento", icon: Ban },
];

/**
 * Ações de status de um atendimento da própria profissional. Tudo manual: nada muda sozinho.
 * Cancelar pede confirmação na própria tela e libera o horário.
 */
export function StatusActions({
  appointmentId,
  status,
  clientName,
  variant,
  afterCancelHref,
  setStatus = setAppointmentStatusAction,
}: StatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const available = OPTIONS.filter((o) => canTransition(status, o.next));
  if (available.length === 0) return null; // cancelado é definitivo: sem ações

  // ação principal: confirmar o que aguarda; concluir o que já está confirmado
  // (em concluído e não compareceu não há principal: só "Reabrir", tratado mais abaixo)
  const primary = available.find((o) => o.next === (status === "awaiting_confirmation" ? "confirmed" : "completed"))!;
  const others = available.filter((o) => o !== primary);

  function run(next: AppointmentStatus) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await setStatus(appointmentId, next, status);
        if (!result.ok) {
          setError(result.error);
          router.refresh();
          return;
        }
        setConfirmingCancel(false);
        setMenuOpen(false);
        if (next === "cancelled") router.push(afterCancelHref);
        else router.refresh();
      } catch {
        setError("Não foi possível concluir. Verifique a conexão e tente de novo.");
      }
    });
  }

  function choose(option: Option) {
    if (option.next === "cancelled") setConfirmingCancel(true);
    else run(option.next);
  }

  const busy = isPending;

  // concluído ou "não compareceu" marcados por engano: um toque devolve para confirmado
  if (isReopen(status, "confirmed")) {
    return (
      <div className={variant === "card" ? "border-t border-border p-3" : "space-y-3"}>
        {error && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button variant="outline" size={variant === "detail" ? "lg" : "default"} className="w-full" disabled={busy} onClick={() => run("confirmed")}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
          Reabrir atendimento
        </Button>
      </div>
    );
  }

  if (confirmingCancel) {
    return (
      <div role="alertdialog" aria-label="Confirmar cancelamento" className="space-y-3 border-t border-border bg-muted p-4">
        <p className="text-[0.95rem] text-cocoa">
          Cancelar o atendimento de <strong>{clientName}</strong>? O horário será liberado e o atendimento sai da agenda.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" disabled={busy} onClick={() => setConfirmingCancel(false)}>
            Voltar
          </Button>
          <Button size="lg" className="flex-1" disabled={busy} onClick={() => run("cancelled")}>
            {busy && <LoaderCircle className="animate-spin" aria-hidden />}
            Cancelar atendimento
          </Button>
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-xl bg-nude px-4 py-3 text-sm text-cocoa">
            {error}
          </p>
        )}
        <Button size="lg" className="w-full" disabled={busy} onClick={() => choose(primary)}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <primary.icon aria-hidden />}
          {primary.label}
        </Button>
        {others.map((o) => (
          <Button key={o.next} variant="outline" size="lg" className="w-full" disabled={busy} onClick={() => choose(o)}>
            <o.icon aria-hidden />
            {o.label}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      {error && (
        <p role="alert" className="px-4 pt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2 p-3">
        <Button className="flex-1" disabled={busy} onClick={() => choose(primary)}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <primary.icon aria-hidden />}
          {primary.next === "confirmed" ? "Confirmar" : "Concluir"}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          aria-expanded={menuOpen}
          aria-label={`Mais ações para ${clientName}`}
          onClick={() => setMenuOpen((v) => !v)}
        >
          Mais
          <ChevronDown className={cn("transition-transform", menuOpen && "rotate-180")} aria-hidden />
        </Button>
      </div>
      {menuOpen && (
        <ul className="divide-y divide-border border-t border-border">
          {others.map((o) => (
            <li key={o.next}>
              <button
                type="button"
                disabled={busy}
                onClick={() => choose(o)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 px-4 text-left text-[0.95rem] active:bg-muted disabled:opacity-50",
                  o.next === "cancelled" ? "text-destructive" : "text-cocoa",
                )}
              >
                <o.icon className="size-5" strokeWidth={1.7} aria-hidden />
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
