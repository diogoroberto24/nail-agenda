"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { createAppointmentAction, type ConflictInfo, type SaveAppointmentResult } from "@/app/(app)/agendamentos/actions";
import { useDraft, useStepGuard } from "@/components/appointments/wizard/draft-context";
import { StepFooter } from "@/components/appointments/wizard/step-footer";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { appointmentSchema } from "@/lib/appointments/schema";
import { endOf } from "@/lib/appointments/slots";
import { stepHref, SUCCESS_HREF, type StepId } from "@/lib/appointments/wizard";
import { formatBRL, parsePrice } from "@/lib/money";
import { formatLongDateCapitalized } from "@/lib/timezone";
import { useFormIds } from "@/lib/use-form-ids";

/** Limite de caracteres das observações neste fluxo. */
export const NOTES_MAX = 200;

type FieldErrors = Partial<Record<"durationMinutes" | "price" | "notes", string>>;

/**
 * Etapa 4: resumo (cada linha leva à etapa correspondente para editar, menos a Profissional), ajuste de
 * duração e preço só deste atendimento, observações e o botão Agendar.
 * Se o horário cruzar outro atendimento da profissional, abre o aviso "Horário ocupado" (nunca bloqueia).
 */
export function DetailsStep() {
  const id = useFormIds();
  const router = useRouter();
  const { draft, update, professionalName, setSaved } = useDraft();
  const ready = useStepGuard("detalhes");
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[] | null>(null);

  if (!ready || !draft.client || !draft.service) return <div className="px-5 text-sm text-taupe-soft">Carregando...</div>;

  const duration = Number(draft.durationMinutes);
  const durationOk = /^\d+$/.test(draft.durationMinutes.trim()) && duration > 0;
  const end = durationOk ? endOf(draft.date, draft.time, duration) : null;
  const priceValue = parsePrice(draft.price);
  const client = draft.client;
  const service = draft.service;

  function submit(confirmConflict: boolean) {
    setServerError(null);
    const values = {
      clientId: client.id,
      serviceId: service.id,
      date: draft.date,
      time: draft.time,
      durationMinutes: draft.durationMinutes,
      price: draft.price,
      notes: draft.notes,
    };
    const parsed = appointmentSchema.safeParse(values);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if ((key === "durationMinutes" || key === "price" || key === "notes") && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      if (Object.keys(next).length === 0) setServerError("Confira os dados e tente de novo.");
      return;
    }
    setErrors({});

    startTransition(async () => {
      let result: SaveAppointmentResult;
      try {
        result = await createAppointmentAction(draft.attemptId, values, confirmConflict);
      } catch {
        setServerError("Não foi possível salvar. Verifique a conexão e tente de novo.");
        return;
      }
      if (result.ok) {
        setConflicts(null);
        setSaved({
          id: result.id,
          clientName: client.name,
          clientPhone: client.phone,
          serviceName: service.name,
          date: draft.date,
          time: draft.time,
          durationMinutes: duration,
          price: parsePrice(draft.price) ?? 0,
        });
        router.push(SUCCESS_HREF);
        return;
      }
      if (result.code === "conflict") {
        setConflicts(result.conflicts);
        return;
      }
      setServerError(result.error);
    });
  }

  const rows: { step: StepId; label: string; value: string; detail?: string }[] = [
    { step: "cliente", label: "Cliente", value: client.name, detail: client.phone },
    { step: "servico", label: "Serviço", value: service.name },
    {
      step: "horario",
      label: "Data e horário",
      value: formatLongDateCapitalized(draft.date),
      detail: end ? `${draft.time} – ${end.time}${end.nextDay ? " (dia seguinte)" : ""}` : draft.time,
    },
  ];

  return (
    <div className="space-y-5 px-5">
      {serverError && (
        <p role="alert" className="rounded-xl bg-nude px-4 py-3 text-sm text-cocoa">
          {serverError}
        </p>
      )}

      <section aria-label="Resumo" className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {rows.map((row) => (
          <Link
            key={row.step}
            href={stepHref(row.step, { retorno: true })}
            aria-label={`${row.label}: ${row.value}${row.detail ? `, ${row.detail}` : ""}. Alterar`}
            className="flex min-h-14 items-center gap-3 px-4 py-2.5 active:bg-muted"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-taupe-soft">{row.label}</span>
              <span className="block truncate font-medium text-cocoa">{row.value}</span>
              {row.detail && <span className="block truncate text-sm text-taupe-soft">{row.detail}</span>}
            </span>
            <ChevronRight className="size-5 shrink-0 text-taupe-soft" aria-hidden />
          </Link>
        ))}
        <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-taupe-soft">Profissional</span>
            <span className="block truncate font-medium text-cocoa">{professionalName}</span>
          </span>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Field
          id={id("duracao")}
          label="Duração (min)"
          error={errors.durationMinutes}
          hint={`Padrão: ${service.durationMinutes} min`}
        >
          <Input
            id={id("duracao")}
            inputMode="numeric"
            autoComplete="off"
            value={draft.durationMinutes}
            aria-invalid={errors.durationMinutes ? true : undefined}
            aria-describedby={`${id("duracao")}-msg`}
            onChange={(e) => update({ durationMinutes: e.target.value })}
          />
        </Field>
        <Field id={id("preco")} label="Preço (R$)" error={errors.price} hint={`Padrão: ${formatBRL(service.price)}`}>
          <Input
            id={id("preco")}
            inputMode="decimal"
            autoComplete="off"
            value={draft.price}
            aria-invalid={errors.price ? true : undefined}
            aria-describedby={`${id("preco")}-msg`}
            onChange={(e) => update({ price: e.target.value })}
          />
        </Field>
      </div>
      <p className="-mt-3 text-sm text-taupe-soft">Ajustes de duração e preço valem só para este atendimento.</p>

      <Field id={id("obs")} label="Observações" optional error={errors.notes} hint={`${draft.notes.length}/${NOTES_MAX}`}>
        <Textarea
          id={id("obs")}
          rows={2}
          maxLength={NOTES_MAX}
          value={draft.notes}
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={`${id("obs")}-msg`}
          onChange={(e) => update({ notes: e.target.value })}
        />
      </Field>

      <p className="flex items-baseline justify-between rounded-xl bg-muted px-4 py-3 text-cocoa">
        <span className="text-sm text-taupe-soft">Valor</span>
        <span className="text-lg font-semibold">{priceValue !== null ? formatBRL(priceValue) : "—"}</span>
      </p>

      <StepFooter canContinue onContinue={() => submit(false)} hint="" label="Agendar" pending={isPending} />

      {conflicts && (
        <BusyDialog
          conflicts={conflicts}
          pending={isPending}
          onClose={() => setConflicts(null)}
          onChooseOther={() => {
            setConflicts(null);
            router.push(stepHref("horario", { retorno: true }));
          }}
          onConfirm={() => submit(true)}
        />
      )}
    </div>
  );
}

function BusyDialog({
  conflicts,
  pending,
  onClose,
  onChooseOther,
  onConfirm,
}: {
  conflicts: ConflictInfo[];
  pending: boolean;
  onClose: () => void;
  onChooseOther: () => void;
  onConfirm: () => void;
}) {
  const titleId = useFormIds()("busy-title");
  const firstButton = useRef<HTMLButtonElement>(null);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    firstButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-cocoa/40 p-4 sm:items-center">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md space-y-4 rounded-2xl bg-card p-5 shadow-soft">
        <div className="space-y-2">
          <h2 id={titleId} className="flex items-center gap-2 text-xl font-semibold text-cocoa">
            <TriangleAlert className="size-5 shrink-0 text-rose-deep" aria-hidden />
            Horário ocupado
          </h2>
          <p className="text-[0.95rem] text-taupe-soft">Você já tem atendimento neste horário:</p>
          <ul className="list-inside list-disc text-[0.95rem] text-cocoa">
            {conflicts.map((c) => (
              <li key={c.id}>
                {c.start} às {c.end}, {c.clientName}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <Button ref={firstButton} size="lg" disabled={pending} onClick={onChooseOther}>
            Escolher outro horário
          </Button>
          <Button variant="outline" size="lg" disabled={pending} onClick={onConfirm}>
            Agendar mesmo assim
          </Button>
          <Button variant="ghost" size="lg" disabled={pending} onClick={onClose}>
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}
