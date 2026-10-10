"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  checkClientPhoneAction,
  createClientAction,
  updateClientAction,
  type DuplicateClient,
  type SaveClientResult,
} from "@/app/(app)/clientes/actions";
import { formatBirthday, parseBirthday } from "@/lib/clients/birthday";
import { clientSchema, type ClientFormValues } from "@/lib/clients/schema";
import { formatBrazilPhone, normalizeBrazilPhone } from "@/lib/phone";
import { useFormIds } from "@/lib/use-form-ids";

type ClientFormProps = {
  /** quando informado, o formulário edita essa cliente; senão cria uma nova */
  clientId?: string;
  defaultValues?: Partial<ClientFormValues>;
  /** onde voltar ao cancelar */
  cancelHref: string;
  /** permite injetar as ações nos testes */
  actions?: {
    create: typeof createClientAction;
    update: typeof updateClientAction;
    checkPhone: typeof checkClientPhoneAction;
  };
};

export function ClientForm({
  clientId,
  defaultValues,
  cancelHref,
  actions = { create: createClientAction, update: updateClientAction, checkPhone: checkClientPhoneAction },
}: ClientFormProps) {
  const id = useFormIds();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateClient[]>([]);
  const [lastChecked, setLastChecked] = useState("");
  const isEdit = Boolean(clientId);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { fullName: "", phone: "", notes: "", birthday: "", ...defaultValues },
  });

  const phoneField = register("phone");
  const birthdayField = register("birthday");

  function submit(values: ClientFormValues, allowDuplicate: boolean) {
    setServerError(null);
    startTransition(async () => {
      let result: SaveClientResult;
      try {
        result = clientId
          ? await actions.update(clientId, values, allowDuplicate)
          : await actions.create(values, allowDuplicate);
      } catch {
        // os campos continuam preenchidos
        setServerError("Não foi possível salvar. Verifique a conexão e tente de novo.");
        return;
      }

      if (result.ok) {
        // o Next mantém a tela montada (escondida): sem isso, "Nova cliente" reabriria preenchida com a anterior
        if (!clientId) {
          reset();
          setDuplicates([]);
          setLastChecked("");
        }
        router.push(`/clientes/${result.id}?salvo=1`);
        return;
      }
      if (result.code === "duplicate") {
        setDuplicates(result.duplicates);
        return;
      }
      setServerError(result.error);
    });
  }

  /** Ao sair do campo: formata o telefone e avisa se já houver cadastro com ele. */
  async function onPhoneBlur() {
    const raw = getValues("phone");
    const normalized = normalizeBrazilPhone(raw);
    if (!normalized) return;
    setValue("phone", formatBrazilPhone(normalized));
    if (normalized === lastChecked) return;
    setLastChecked(normalized);
    try {
      setDuplicates(await actions.checkPhone(raw, clientId));
    } catch {
      // a verificação final acontece ao salvar
    }
  }

  return (
    <form onSubmit={handleSubmit((v) => submit(v, false))} noValidate className="space-y-5 px-5">
      {serverError && (
        <p role="alert" className="rounded-xl bg-nude px-4 py-3 text-sm text-cocoa">
          {serverError}
        </p>
      )}

      <Field id={id("fullName")} label="Nome completo" error={errors.fullName?.message}>
        <Input
          id={id("fullName")}
          autoComplete="off"
          autoCapitalize="words"
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={errors.fullName ? `${id("fullName")}-msg` : undefined}
          {...register("fullName")}
        />
      </Field>

      <Field id={id("phone")} label="Telefone com DDD" error={errors.phone?.message} hint="Ex.: (11) 99999-8888">
        <Input
          id={id("phone")}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={`${id("phone")}-msg`}
          {...phoneField}
          onBlur={(e) => {
            phoneField.onBlur(e);
            void onPhoneBlur();
          }}
        />
      </Field>

      {duplicates.length > 0 && (
        <div role="alert" className="space-y-3 rounded-xl border border-[#e0c9a0] bg-[#f4ead5] px-4 py-3 text-sm text-[#6b4e12]">
          <p className="flex items-start gap-2 font-medium">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Este telefone já está cadastrado.
          </p>
          <ul className="space-y-1">
            {duplicates.map((d) => (
              <li key={d.id}>
                <Link href={`/clientes/${d.id}`} className="inline-flex min-h-11 items-center font-medium underline">
                  Abrir cadastro de {d.fullName}
                  {d.archived ? " (arquivada)" : ""}
                </Link>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isPending}
            onClick={handleSubmit((v) => submit(v, true))}
          >
            {isEdit ? "Salvar mesmo assim" : "Cadastrar mesmo assim"}
          </Button>
        </div>
      )}

      <Field
        id={id("birthday")}
        label="Aniversário"
        optional
        error={errors.birthday?.message}
        hint="Dia e mês, ex.: 15/03. O ano é opcional."
      >
        <Input
          id={id("birthday")}
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm"
          aria-invalid={errors.birthday ? true : undefined}
          aria-describedby={`${id("birthday")}-msg`}
          {...birthdayField}
          onBlur={(e) => {
            birthdayField.onBlur(e);
            // ao sair do campo, arruma o formato (5/3 vira 05/03)
            const parsed = parseBirthday(getValues("birthday") ?? "");
            if (parsed) setValue("birthday", formatBirthday(parsed));
          }}
        />
      </Field>

      <Field id={id("notes")} label="Observações" optional error={errors.notes?.message}>
        <Textarea
          id={id("notes")}
          rows={3}
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={errors.notes ? `${id("notes")}-msg` : undefined}
          {...register("notes")}
        />
      </Field>

      <div className="flex flex-col gap-3 pt-2">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          {isPending ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar cliente"}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.push(cancelHref)} disabled={isPending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
