"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, LoaderCircle, TriangleAlert } from "lucide-react";
import { ClientPicker, type SelectedClient } from "@/components/appointments/client-picker";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  checkConflictsAction,
  createAppointmentAction,
  updateAppointmentAction,
  type ConflictInfo,
  type SaveAppointmentResult,
} from "@/app/(app)/agendamentos/actions";
import { appointmentSchema, toAppointmentTimes, type AppointmentFormValues } from "@/lib/appointments/schema";
import { formatDuration } from "@/lib/datetime";
import { formatBRL, formatPriceInput, parsePrice } from "@/lib/money";
import { formatDateBR, toZonedParts } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { newUuid } from "@/lib/uuid";

export type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  active: boolean;
};

type Actions = {
  create: typeof createAppointmentAction;
  update: typeof updateAppointmentAction;
  checkConflicts: typeof checkConflictsAction;
};

const DEFAULT_ACTIONS: Actions = {
  create: createAppointmentAction,
  update: updateAppointmentAction,
  checkConflicts: checkConflictsAction,
};

type AppointmentFormProps = {
  appointmentId?: string;
  professionalName: string;
  services: ServiceOption[];
  initialClient: SelectedClient | null;
  defaultValues: Partial<AppointmentFormValues>;
  cancelHref: string;
  /** permite injetar as ações nos testes */
  actions?: Actions;
  pickerActions?: React.ComponentProps<typeof ClientPicker>["actions"];
};

export function AppointmentForm({
  appointmentId,
  professionalName,
  services,
  initialClient,
  defaultValues,
  cancelHref,
  actions = DEFAULT_ACTIONS,
  pickerActions,
}: AppointmentFormProps) {
  const router = useRouter();
  const isEdit = Boolean(appointmentId);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [client, setClient] = useState<SelectedClient | null>(initialClient);
  // identificador da tentativa: um segundo envio igual não cria atendimento duplicado
  const [attemptId] = useState(() => newUuid());

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      clientId: initialClient?.id ?? "",
      serviceId: "",
      date: "",
      time: "",
      durationMinutes: "",
      price: "",
      notes: "",
      ...defaultValues,
    },
  });

  const [serviceId, date, time, durationMinutes, price] = useWatch({
    control,
    name: ["serviceId", "date", "time", "durationMinutes", "price"],
  });

  const service = services.find((s) => s.id === serviceId);
  const timesParsed = appointmentSchema.pick({ date: true, time: true, durationMinutes: true }).safeParse({ date, time, durationMinutes });
  const end = timesParsed.success ? toAppointmentTimes(timesParsed.data).end : null;
  const endParts = end ? toZonedParts(end) : null;
  const priceValue = parsePrice(price ?? "");

  // aviso de sobreposição em tempo real (só informa; não bloqueia)
  const checkKey = timesParsed.success ? `${date}|${time}|${durationMinutes}` : "";
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!checkKey) {
        if (!cancelled) setConflicts([]);
        return;
      }
      try {
        const found = await actions.checkConflicts({ date, time, durationMinutes, excludeId: appointmentId });
        if (!cancelled) setConflicts(found);
      } catch {
        // a verificação final acontece ao salvar
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkKey, appointmentId, actions]);

  function chooseService(option: ServiceOption) {
    setValue("serviceId", option.id, { shouldValidate: true });
    // duração e preço do serviço entram como ponto de partida; podem ser ajustados só neste atendimento
    setValue("durationMinutes", String(option.durationMinutes), { shouldValidate: true });
    setValue("price", formatPriceInput(option.price), { shouldValidate: true });
  }

  function chooseClient(next: SelectedClient | null) {
    setClient(next);
    setValue("clientId", next?.id ?? "", { shouldValidate: Boolean(next) });
  }

  function submit(values: AppointmentFormValues, confirmConflict: boolean) {
    setServerError(null);
    startTransition(async () => {
      let result: SaveAppointmentResult;
      try {
        result = appointmentId
          ? await actions.update(appointmentId, values, confirmConflict)
          : await actions.create(attemptId, values, confirmConflict);
      } catch {
        // os campos continuam preenchidos
        setServerError("Não foi possível salvar. Verifique a conexão e tente de novo.");
        return;
      }
      if (result.ok) {
        router.push(`/agenda?data=${result.date}&destaque=${result.id}${result.statusReset ? "&remarcado=1" : ""}`);
        return;
      }
      if (result.code === "conflict") {
        setConflicts(result.conflicts);
        return;
      }
      setServerError(result.error);
    });
  }

  const hasConflict = conflicts.length > 0;

  return (
    <form onSubmit={handleSubmit((v) => submit(v, hasConflict))} noValidate className="space-y-6 px-5">
      {serverError && (
        <p role="alert" className="rounded-xl bg-nude px-4 py-3 text-sm text-cocoa">
          {serverError}
        </p>
      )}

      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-taupe-soft">
        Atendimento de <strong className="font-semibold text-cocoa">{professionalName}</strong>
      </p>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-cocoa">Cliente</legend>
        <ClientPicker value={client} onChange={chooseClient} error={errors.clientId?.message} actions={pickerActions} />
        {errors.clientId && <p className="text-sm text-destructive">{errors.clientId.message}</p>}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-cocoa">Serviço</legend>
        {services.length === 0 ? (
          <p className="rounded-xl border border-dashed border-input bg-card px-4 py-5 text-sm text-taupe-soft">
            Você ainda não tem serviços ativos.{" "}
            <Link href="/servicos/novo" className="font-medium text-rose-deep underline">
              Cadastrar serviço
            </Link>
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
                    selected ? "border-cocoa bg-cocoa text-offwhite" : "border-border bg-card text-cocoa",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {s.name}
                      {!s.active ? " (desativado)" : ""}
                    </span>
                    <span className={cn("block text-sm", selected ? "text-offwhite/80" : "text-taupe-soft")}>
                      {formatDuration(s.durationMinutes)}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium">{formatBRL(s.price)}</span>
                </button>
              );
            })}
          </div>
        )}
        {errors.serviceId && <p className="text-sm text-destructive">{errors.serviceId.message}</p>}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field id="date" label="Data" error={errors.date?.message}>
          <Input id="date" type="date" aria-invalid={errors.date ? true : undefined} aria-describedby={errors.date ? "date-msg" : undefined} {...register("date")} />
        </Field>
        <Field id="time" label="Horário" error={errors.time?.message}>
          <Input id="time" type="time" step={300} aria-invalid={errors.time ? true : undefined} aria-describedby={errors.time ? "time-msg" : undefined} {...register("time")} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          id="durationMinutes"
          label="Duração (min)"
          error={errors.durationMinutes?.message}
          hint={service ? `Padrão: ${service.durationMinutes} min` : undefined}
        >
          <Input
            id="durationMinutes"
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={errors.durationMinutes ? true : undefined}
            aria-describedby="durationMinutes-msg"
            {...register("durationMinutes")}
          />
        </Field>
        <Field id="price" label="Preço (R$)" error={errors.price?.message} hint={service ? `Padrão: ${formatBRL(service.price)}` : undefined}>
          <Input
            id="price"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={errors.price ? true : undefined}
            aria-describedby="price-msg"
            {...register("price")}
          />
        </Field>
      </div>
      <p className="-mt-3 text-sm text-taupe-soft">Ajustes de duração e preço valem só para este atendimento.</p>

      <Field id="notes" label="Observações" optional error={errors.notes?.message}>
        <Textarea id="notes" rows={2} aria-invalid={errors.notes ? true : undefined} aria-describedby={errors.notes ? "notes-msg" : undefined} {...register("notes")} />
      </Field>

      {hasConflict && (
        <div role="alert" className="space-y-2 rounded-xl border border-[#e0c9a0] bg-[#f4ead5] px-4 py-3 text-sm text-[#6b4e12]">
          <p className="flex items-start gap-2 font-medium">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Você já tem atendimento neste horário.
          </p>
          <ul className="list-inside list-disc">
            {conflicts.map((c) => (
              <li key={c.id}>
                {c.start} às {c.end}, {c.clientName}
              </li>
            ))}
          </ul>
          <p>Você pode agendar mesmo assim.</p>
        </div>
      )}

      <section aria-label="Resumo" className="space-y-1.5 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-cocoa">
          <CalendarClock className="size-5 text-rose-deep" aria-hidden />
          Resumo
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.95rem]">
          <dt className="text-taupe-soft">Cliente</dt>
          <dd className="text-right font-medium text-cocoa">{client?.name ?? "—"}</dd>
          <dt className="text-taupe-soft">Serviço</dt>
          <dd className="text-right font-medium text-cocoa">{service?.name ?? "—"}</dd>
          <dt className="text-taupe-soft">Início</dt>
          <dd className="text-right font-medium text-cocoa">{timesParsed.success ? `${formatDateBR(date)} às ${time}` : "—"}</dd>
          <dt className="text-taupe-soft">Término</dt>
          <dd className="text-right font-medium text-cocoa">
            {endParts ? `${endParts.date !== date ? `${formatDateBR(endParts.date)} às ` : ""}${endParts.time}` : "—"}
          </dd>
          <dt className="text-taupe-soft">Preço</dt>
          <dd className="text-right font-medium text-cocoa">{priceValue !== null ? formatBRL(priceValue) : "—"}</dd>
        </dl>
      </section>

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          {isPending ? "Salvando..." : isEdit ? (hasConflict ? "Salvar mesmo assim" : "Salvar alterações") : hasConflict ? "Agendar mesmo assim" : "Agendar"}
        </Button>
        <Button type="button" variant="ghost" size="lg" disabled={isPending} onClick={() => router.push(cancelHref)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
