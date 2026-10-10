"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signupSchema, type SignupValues } from "@/lib/auth/schemas";
import { useFormIds } from "@/lib/use-form-ids";
import { signup } from "./actions";

export function SignupForm() {
  const id = useFormIds();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "", inviteCode: "" },
  });

  function onSubmit(values: SignupValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await signup(values);
      if (!result.ok) {
        setServerError(result.error);
        return; // os campos continuam preenchidos
      }
      router.replace("/");
      router.refresh();
    });
  }

  const describedBy = (name: string, hasError: boolean) => (hasError ? `${id(name)}-msg` : undefined);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {serverError && (
        <p role="alert" className="rounded-xl bg-nude px-4 py-3 text-sm text-cocoa">
          {serverError}
        </p>
      )}

      <Field id={id("nome")} label="Seu nome" error={errors.fullName?.message} hint="Aparece na agenda e nas mensagens do WhatsApp.">
        <Input
          id={id("nome")}
          autoComplete="name"
          autoCapitalize="words"
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={`${id("nome")}-msg`}
          {...register("fullName")}
        />
      </Field>

      <Field id={id("email")} label="E-mail" error={errors.email?.message}>
        <Input
          id={id("email")}
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy("email", Boolean(errors.email))}
          {...register("email")}
        />
      </Field>

      <Field id={id("senha")} label="Senha" error={errors.password?.message} hint="Pelo menos 8 caracteres.">
        <div className="relative">
          <Input
            id={id("senha")}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            className="pr-12"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={`${id("senha")}-msg`}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-taupe-soft"
          >
            {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        </div>
      </Field>

      <Field id={id("repetir")} label="Repetir a senha" error={errors.confirmPassword?.message}>
        <Input
          id={id("repetir")}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          aria-invalid={errors.confirmPassword ? true : undefined}
          aria-describedby={describedBy("repetir", Boolean(errors.confirmPassword))}
          {...register("confirmPassword")}
        />
      </Field>

      <Field id={id("convite")} label="Código de convite" error={errors.inviteCode?.message} hint="Peça o código para a administradora do salão.">
        <Input
          id={id("convite")}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={errors.inviteCode ? true : undefined}
          aria-describedby={`${id("convite")}-msg`}
          {...register("inviteCode")}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
        {isPending ? "Criando conta..." : "Criar conta"}
      </Button>
    </form>
  );
}
