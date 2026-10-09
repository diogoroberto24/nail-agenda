"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createServiceAction, updateServiceAction, type SaveServiceResult } from "@/app/(app)/servicos/actions";
import { serviceSchema, type ServiceFormValues } from "@/lib/services/schema";
import { cn } from "@/lib/utils";

const PRESETS = [30, 45, 60, 90, 120];

type ServiceFormProps = {
  serviceId?: string;
  defaultValues?: Partial<ServiceFormValues>;
  cancelHref: string;
  /** permite injetar as ações nos testes */
  actions?: { create: typeof createServiceAction; update: typeof updateServiceAction };
};

export function ServiceForm({
  serviceId,
  defaultValues,
  cancelHref,
  actions = { create: createServiceAction, update: updateServiceAction },
}: ServiceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = Boolean(serviceId);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { name: "", description: "", durationMinutes: "", price: "", ...defaultValues },
  });
  const duration = useWatch({ control, name: "durationMinutes" });

  function onSubmit(values: ServiceFormValues) {
    setServerError(null);
    startTransition(async () => {
      let result: SaveServiceResult;
      try {
        result = serviceId ? await actions.update(serviceId, values) : await actions.create(values);
      } catch {
        // os campos continuam preenchidos
        setServerError("Não foi possível salvar. Verifique a conexão e tente de novo.");
        return;
      }
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/servicos?salvo=1");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5 px-5">
      {serverError && (
        <p role="alert" className="rounded-xl bg-nude px-4 py-3 text-sm text-cocoa">
          {serverError}
        </p>
      )}

      <Field id="name" label="Nome do serviço" error={errors.name?.message}>
        <Input
          id="name"
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "name-msg" : undefined}
          {...register("name")}
        />
      </Field>

      <Field id="description" label="Descrição" optional error={errors.description?.message}>
        <Textarea
          id="description"
          rows={2}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? "description-msg" : undefined}
          {...register("description")}
        />
      </Field>

      <Field
        id="durationMinutes"
        label="Duração padrão (minutos)"
        error={errors.durationMinutes?.message}
        hint="Cada agendamento pode ajustar a duração sem mudar este padrão."
      >
        <Input
          id="durationMinutes"
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={errors.durationMinutes ? true : undefined}
          aria-describedby="durationMinutes-msg"
          {...register("durationMinutes")}
        />
        <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Durações comuns">
          {PRESETS.map((min) => (
            <button
              key={min}
              type="button"
              onClick={() => setValue("durationMinutes", String(min), { shouldValidate: true })}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium",
                duration === String(min) ? "border-cocoa bg-cocoa text-offwhite" : "border-input bg-card text-cocoa",
              )}
            >
              {min} min
            </button>
          ))}
        </div>
      </Field>

      <Field
        id="price"
        label="Preço padrão (R$)"
        error={errors.price?.message}
        hint="Ex.: 50 ou 50,00. O preço de atendimentos já marcados não muda."
      >
        <Input
          id="price"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={errors.price ? true : undefined}
          aria-describedby="price-msg"
          {...register("price")}
        />
      </Field>

      <div className="flex flex-col gap-3 pt-2">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          {isPending ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar serviço"}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.push(cancelHref)} disabled={isPending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
