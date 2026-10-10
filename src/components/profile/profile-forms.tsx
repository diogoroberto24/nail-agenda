"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { Field } from "@/components/form-field";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  changePasswordAction,
  requestEmailChangeAction,
  updateDisplayNameAction,
  type ProfileResult,
} from "@/app/(app)/perfil/actions";
import {
  displayNameSchema,
  emailChangeSchema,
  passwordChangeSchema,
  type DisplayNameValues,
  type EmailChangeValues,
  type PasswordChangeValues,
} from "@/lib/profile/schema";
import { useFormIds } from "@/lib/use-form-ids";

type Actions = {
  updateName: typeof updateDisplayNameAction;
  changePassword: typeof changePasswordAction;
  requestEmail: typeof requestEmailChangeAction;
};

const DEFAULT_ACTIONS: Actions = {
  updateName: updateDisplayNameAction,
  changePassword: changePasswordAction,
  requestEmail: requestEmailChangeAction,
};

function Feedback({ error, message }: { error: string | null; message: string | null }) {
  if (error) {
    return (
      <p role="alert" className="rounded-xl bg-nude px-4 py-3 text-sm text-cocoa">
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl bg-[#e4ede5] px-4 py-3 text-sm font-medium text-[#2f5a3a]">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {message}
      </p>
    );
  }
  return null;
}

/** Executa a ação, tratando falha de conexão sem perder o que foi digitado. */
async function run(action: () => Promise<ProfileResult>): Promise<ProfileResult> {
  try {
    return await action();
  } catch {
    return { ok: false, error: "Não foi possível salvar. Verifique a conexão e tente de novo." };
  }
}

export function DisplayNameForm({ initialName, actions = DEFAULT_ACTIONS }: { initialName: string; actions?: Actions }) {
  const id = useFormIds();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DisplayNameValues>({ resolver: zodResolver(displayNameSchema), defaultValues: { displayName: initialName } });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit((values) => {
        setError(null);
        setMessage(null);
        startTransition(async () => {
          const result = await run(() => actions.updateName(values));
          if (result.ok) setMessage(result.message ?? "Salvo.");
          else setError(result.error);
        });
      })}
    >
      <Feedback error={error} message={message} />
      <Field id={id("displayName")} label="Nome de exibição" error={errors.displayName?.message} hint="Aparece na agenda e na mensagem enviada às clientes.">
        <Input
          id={id("displayName")}
          autoComplete="name"
          aria-invalid={errors.displayName ? true : undefined}
          aria-describedby={`${id("displayName")}-msg`}
          {...register("displayName")}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
        {isPending ? "Salvando..." : "Salvar nome"}
      </Button>
    </form>
  );
}

export function PasswordForm({ actions = DEFAULT_ACTIONS }: { actions?: Actions }) {
  const id = useFormIds();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError: setFieldError,
    formState: { errors },
  } = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit((values) => {
        setError(null);
        setMessage(null);
        startTransition(async () => {
          const result = await run(() => actions.changePassword(values));
          if (result.ok) {
            setMessage(result.message ?? "Senha alterada.");
            reset(); // limpa os campos de senha depois de trocar
            return;
          }
          if (result.field === "currentPassword" || result.field === "newPassword") {
            setFieldError(result.field, { message: result.error });
          } else {
            setError(result.error);
          }
        });
      })}
    >
      <Feedback error={error} message={message} />
      <Field id={id("currentPassword")} label="Senha atual" error={errors.currentPassword?.message}>
        <PasswordInput
          id={id("currentPassword")}
          autoComplete="current-password"
          aria-invalid={errors.currentPassword ? true : undefined}
          aria-describedby={errors.currentPassword ? `${id("currentPassword")}-msg` : undefined}
          {...register("currentPassword")}
        />
      </Field>
      <Field id={id("newPassword")} label="Nova senha" error={errors.newPassword?.message} hint="Pelo menos 8 caracteres.">
        <PasswordInput
          id={id("newPassword")}
          autoComplete="new-password"
          aria-invalid={errors.newPassword ? true : undefined}
          aria-describedby={`${id("newPassword")}-msg`}
          {...register("newPassword")}
        />
      </Field>
      <Field id={id("confirmPassword")} label="Repita a nova senha" error={errors.confirmPassword?.message}>
        <PasswordInput
          id={id("confirmPassword")}
          autoComplete="new-password"
          aria-invalid={errors.confirmPassword ? true : undefined}
          aria-describedby={errors.confirmPassword ? `${id("confirmPassword")}-msg` : undefined}
          {...register("confirmPassword")}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
        {isPending ? "Alterando..." : "Alterar senha"}
      </Button>
    </form>
  );
}

export function EmailForm({ currentEmail, actions = DEFAULT_ACTIONS }: { currentEmail: string; actions?: Actions }) {
  const id = useFormIds();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError: setFieldError,
    formState: { errors },
  } = useForm<EmailChangeValues>({
    resolver: zodResolver(emailChangeSchema),
    defaultValues: { newEmail: "", currentPassword: "" },
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit((values) => {
        setError(null);
        setMessage(null);
        startTransition(async () => {
          const result = await run(() => actions.requestEmail(values));
          if (result.ok) {
            setMessage(result.message ?? "Pedido enviado.");
            reset();
            return;
          }
          if (result.field) setFieldError(result.field === "newPassword" ? "currentPassword" : result.field, { message: result.error });
          else setError(result.error);
        });
      })}
    >
      <p className="text-sm text-taupe-soft">
        E-mail de acesso atual: <strong className="font-semibold text-cocoa">{currentEmail}</strong>
      </p>
      <Feedback error={error} message={message} />
      <Field id={id("newEmail")} label="Novo e-mail" error={errors.newEmail?.message}>
        <Input
          id={id("newEmail")}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          aria-invalid={errors.newEmail ? true : undefined}
          aria-describedby={errors.newEmail ? `${id("newEmail")}-msg` : undefined}
          {...register("newEmail")}
        />
      </Field>
      <Field id={id("emailPassword")} label="Senha atual" error={errors.currentPassword?.message}>
        <PasswordInput
          id={id("emailPassword")}
          autoComplete="current-password"
          aria-invalid={errors.currentPassword ? true : undefined}
          aria-describedby={errors.currentPassword ? `${id("emailPassword")}-msg` : undefined}
          {...register("currentPassword")}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
        {isPending ? "Enviando..." : "Trocar e-mail"}
      </Button>
    </form>
  );
}
