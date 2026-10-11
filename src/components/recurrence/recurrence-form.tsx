"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, LoaderCircle, TriangleAlert } from "lucide-react";
import {
  changeRecurrenceAction,
  createRecurrenceAction,
  previewRecurrenceAction,
} from "@/app/(app)/recorrencias/actions";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration } from "@/lib/datetime";
import { formatBRL, formatPriceInput, parsePrice } from "@/lib/money";
import { describeRule, type PlannedOccurrence } from "@/lib/recurrence/rules";
import {
  RECURRENCE_NOTES_MAX,
  recurrenceSchema,
  toRule,
  type RecurrenceFormValues,
} from "@/lib/recurrence/schema";
import { formatDateBR, formatShortWeekday } from "@/lib/timezone";
import { newUuid } from "@/lib/uuid";
import { useFormIds } from "@/lib/use-form-ids";
import { cn } from "@/lib/utils";

export type RecurrenceServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
};

type Actions = {
  preview: typeof previewRecurrenceAction;
  create: typeof createRecurrenceAction;
  change: typeof changeRecurrenceAction;
};
const DEFAULT_ACTIONS: Actions = {
  preview: previewRecurrenceAction,
  create: createRecurrenceAction,
  change: changeRecurrenceAction,
};

type Props = {
  clientId: string;
  clientName: string;
  services: RecurrenceServiceOption[];
  defaultValues: Partial<RecurrenceFormValues>;
  /** quando informado, o formulário ALTERA essa recorrência a partir da data escolhida */
  changeOfId?: string;
  /** para onde ir ao salvar e ao cancelar */
  doneHref: string;
  cancelHref: string;
  actions?: Actions;
};

const FREQUENCIES: {
  value: RecurrenceFormValues["frequency"];
  label: string;
}[] = [
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "every_days", label: "A cada X dias" },
];

const weekdayLabel = (date: string) => {
  const w = formatShortWeekday(date);
  return w.charAt(0).toUpperCase() + w.slice(1);
};

export function RecurrenceForm({
  clientId,
  clientName,
  services,
  defaultValues,
  changeOfId,
  doneHref,
  cancelHref,
  actions = DEFAULT_ACTIONS,
}: Props) {
  const id = useFormIds();
  const router = useRouter();
  const isChange = Boolean(changeOfId);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlannedOccurrence[] | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  // um reenvio da MESMA tentativa não cria duas recorrências; muda depois de salvar
  const [attemptId, setAttemptId] = useState(() => newUuid());

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<RecurrenceFormValues>({
    resolver: zodResolver(recurrenceSchema),
    defaultValues: {
      clientId,
      serviceId: "",
      frequency: "weekly",
      intervalDays: "",
      startDate: "",
      time: "",
      durationMinutes: "",
      price: "",
      notes: "",
      endDate: "",
      ...defaultValues,
    },
  });
  const [frequency, serviceId, notes] = useWatch({
    control,
    name: ["frequency", "serviceId", "notes"],
  });
  const service = services.find((s) => s.id === serviceId);

  function chooseService(option: RecurrenceServiceOption) {
    if (option.id === getValues("serviceId")) return;
    setValue("serviceId", option.id, { shouldValidate: true });
    setValue("durationMinutes", String(option.durationMinutes), {
      shouldValidate: true,
    });
    setValue("price", formatPriceInput(option.price), { shouldValidate: true });
  }

  function onPreview(values: RecurrenceFormValues) {
    setError(null);
    startTransition(async () => {
      let result;
      try {
        result = await actions.preview(
          values,
          changeOfId
            ? { recurrenceId: changeOfId, fromDate: values.startDate }
            : undefined,
        );
      } catch {
        setError(
          "Não foi possível conferir as datas. Verifique a conexão e tente de novo.",
        );
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPlan(result.occurrences);
      // por padrão, datas que já têm atendimento são puladas (a profissional pode manter marcando a caixa de volta)
      setSkipped(
        new Set(
          result.occurrences.filter((o) => o.conflict).map((o) => o.date),
        ),
      );
    });
  }

  function onConfirm() {
    const values = getValues();
    setError(null);
    startTransition(async () => {
      const skippedDates = [...skipped];
      try {
        const result = changeOfId
          ? await actions.change(changeOfId, attemptId, values, skippedDates)
          : await actions.create(attemptId, values, skippedDates);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        // o Next mantém a tela montada (escondida): sem isso, "Nova recorrência" reabriria preenchida e reaproveitaria a tentativa
        reset();
        setPlan(null);
        setSkipped(new Set());
        setAttemptId(newUuid());
        router.push(
          `${doneHref}?recorrencia=${isChange ? "alterada" : "criada"}&n=${result.created}`,
        );
      } catch {
        setError(
          "Não foi possível salvar. Verifique a conexão e tente de novo.",
        );
      }
    });
  }

  function toggleSkip(date: string) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  if (plan) {
    const toCreate = plan.filter((o) => !skipped.has(o.date));
    const values = getValues();
    const rule = toRule(values);
    return (
      <div className="space-y-5 px-5">
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-nude px-4 py-3 text-sm text-cocoa"
          >
            {error}
          </p>
        )}
        <section
          aria-label="Resumo da recorrência"
          className="space-y-1 rounded-2xl border border-border bg-card p-4 shadow-soft"
        >
          <h2 className="flex items-center gap-2 text-xl font-semibold text-cocoa">
            <CalendarClock className="size-5 text-rose-deep" aria-hidden />
            {describeRule(rule)}, às {values.time}
          </h2>
          <p className="text-[0.95rem] text-taupe-soft">
            {clientName} · {service?.name} ·{" "}
            {formatDuration(Number(values.durationMinutes))} ·{" "}
            {formatBRL(parsePrice(values.price) ?? 0)}
          </p>
        </section>

        <section aria-labelledby={id("datas")} className="space-y-3">
          <h2 id={id("datas")} className="text-lg font-semibold text-cocoa">
            Datas dos próximos 6 meses
          </h2>
          <p className="text-sm text-taupe-soft" aria-live="polite">
            {toCreate.length === 1
              ? "1 atendimento será criado"
              : `${toCreate.length} atendimentos serão criados`}
            {skipped.size > 0
              ? ` · ${skipped.size} ${skipped.size === 1 ? "data pulada" : "datas puladas"}`
              : ""}
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {plan.map((o) => {
              const isSkipped = skipped.has(o.date);
              return (
                <li key={o.date}>
                  <div className="flex min-h-14 items-center gap-3 px-4 py-2">
                    <Checkbox
                      id={id(`pular-${o.date}`)}
                      checked={isSkipped}
                      onCheckedChange={() => toggleSkip(o.date)}
                    />
                    <label
                      htmlFor={id(`pular-${o.date}`)}
                      className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3"
                    >
                      <span
                        className={cn(
                          "min-w-0 flex-1",
                          isSkipped && "text-taupe-soft line-through",
                        )}
                      >
                        <span className="block font-medium tabular-nums text-cocoa">
                          {weekdayLabel(o.date)}, {formatDateBR(o.date)} às{" "}
                          {o.time}
                        </span>
                        {o.conflict && (
                          <span className="mt-0.5 flex items-center gap-1.5 text-sm text-[#6b4e12] no-underline">
                            <TriangleAlert
                              className="size-3.5 shrink-0"
                              aria-hidden
                            />
                            Você já tem atendimento neste horário
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm text-taupe-soft">
                        {isSkipped ? "Pular" : "Criar"}
                      </span>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-taupe-soft">
            Marque a caixa para pular uma data. Datas com atendimento já marcado
            vêm puladas; desmarque para criar mesmo assim.
          </p>
        </section>

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            size="lg"
            disabled={isPending || toCreate.length === 0}
            onClick={onConfirm}
          >
            {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
            {isPending
              ? "Criando..."
              : isChange
                ? `Alterar e criar ${toCreate.length}`
                : `Criar ${toCreate.length} ${toCreate.length === 1 ? "atendimento" : "atendimentos"}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={() => setPlan(null)}
          >
            Voltar e editar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onPreview)}
      noValidate
      className="space-y-6 px-5"
    >
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-nude px-4 py-3 text-sm text-cocoa"
        >
          {error}
        </p>
      )}
      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-taupe-soft">
        Cliente:{" "}
        <strong className="font-semibold text-cocoa">{clientName}</strong>
      </p>
      {isChange && (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-taupe-soft">
          A recorrência atual termina na véspera da data escolhida. Atendimentos
          futuros que ainda aguardam confirmação são substituídos; os já
          confirmados ficam como estão.
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-cocoa">Serviço</legend>
        {services.length === 0 ? (
          <p className="rounded-xl border border-dashed border-input bg-card px-4 py-5 text-sm text-taupe-soft">
            Você ainda não tem serviços ativos. Cadastre um serviço primeiro.
          </p>
        ) : (
          <div role="radiogroup" aria-label="Serviço" className="space-y-2">
            {services.map((s) => {
              const selected = s.id === serviceId;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => chooseService(s)}
                  className={cn(
                    "flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 text-left",
                    selected
                      ? "border-cocoa bg-cocoa text-offwhite"
                      : "border-border bg-card text-cocoa",
                  )}
                >
                  <span className="min-w-0 truncate font-medium">{s.name}</span>
                  <span
                    className={cn(
                      "shrink-0 text-sm",
                      selected ? "text-offwhite/80" : "text-taupe-soft",
                    )}
                  >
                    {formatDuration(s.durationMinutes)} · {formatBRL(s.price)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {errors.serviceId && (
          <p className="text-sm text-destructive">{errors.serviceId.message}</p>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field
          id={id("start")}
          label={isChange ? "A partir de" : "Primeiro atendimento"}
          error={errors.startDate?.message}
        >
          <Input
            id={id("start")}
            type="date"
            aria-invalid={errors.startDate ? true : undefined}
            aria-describedby={`${id("start")}-msg`}
            {...register("startDate")}
          />
        </Field>
        <Field id={id("time")} label="Horário" error={errors.time?.message}>
          <Input
            id={id("time")}
            type="time"
            step={300}
            aria-invalid={errors.time ? true : undefined}
            aria-describedby={`${id("time")}-msg`}
            {...register("time")}
          />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-cocoa">Repete</legend>
        <Controller
          control={control}
          name="frequency"
          render={({ field }) => (
            <div
              role="radiogroup"
              aria-label="Repete"
              className="grid grid-cols-3 gap-2"
            >
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={field.value === f.value}
                  onClick={() => field.onChange(f.value)}
                  className={cn(
                    "min-h-12 rounded-xl border px-2 text-sm font-medium",
                    field.value === f.value
                      ? "border-cocoa bg-cocoa text-offwhite"
                      : "border-border bg-card text-cocoa",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        />
        {frequency === "weekly" && (
          <p className="text-sm text-taupe-soft">
            Repete no mesmo dia da semana do primeiro atendimento.
          </p>
        )}
        {frequency === "monthly" && (
          <p className="text-sm text-taupe-soft">
            Repete no mesmo dia do mês. Nos meses sem o dia 29, 30 ou 31, usa o
            último dia do mês.
          </p>
        )}
        {frequency === "every_days" && (
          <Field
            id={id("interval")}
            label="De quantos em quantos dias"
            error={errors.intervalDays?.message}
            hint="Ex.: 10 para repetir a cada 10 dias."
          >
            <Input
              id={id("interval")}
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={errors.intervalDays ? true : undefined}
              aria-describedby={`${id("interval")}-msg`}
              {...register("intervalDays")}
            />
          </Field>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field
          id={id("duration")}
          label="Duração (min)"
          error={errors.durationMinutes?.message}
          hint={service ? `Padrão: ${service.durationMinutes} min` : undefined}
        >
          <Input
            id={id("duration")}
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={errors.durationMinutes ? true : undefined}
            aria-describedby={`${id("duration")}-msg`}
            {...register("durationMinutes")}
          />
        </Field>
        <Field
          id={id("price")}
          label="Preço (R$)"
          error={errors.price?.message}
          hint={service ? `Padrão: ${formatBRL(service.price)}` : undefined}
        >
          <Input
            id={id("price")}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={errors.price ? true : undefined}
            aria-describedby={`${id("price")}-msg`}
            {...register("price")}
          />
        </Field>
      </div>

      <Field
        id={id("end")}
        label="Data final"
        optional
        error={errors.endDate?.message}
        hint="Sem data final, o sistema segue repondo atendimentos 6 meses à frente."
      >
        <Input
          id={id("end")}
          type="date"
          aria-invalid={errors.endDate ? true : undefined}
          aria-describedby={`${id("end")}-msg`}
          {...register("endDate")}
        />
      </Field>

      <Field
        id={id("notes")}
        label="Observações"
        optional
        error={errors.notes?.message}
        hint={`${(notes ?? "").length}/${RECURRENCE_NOTES_MAX}`}
      >
        <Textarea
          id={id("notes")}
          rows={2}
          maxLength={RECURRENCE_NOTES_MAX}
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={`${id("notes")}-msg`}
          {...register("notes")}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          size="lg"
          disabled={isPending || services.length === 0}
        >
          {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          {isPending ? "Conferindo..." : "Ver as datas"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          disabled={isPending}
          onClick={() => router.push(cancelHref)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
