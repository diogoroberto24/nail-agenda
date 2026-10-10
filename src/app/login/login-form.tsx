"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginValues } from "@/lib/auth/schemas";
import { login } from "./actions";
import { useFormIds } from "@/lib/use-form-ids";

export function LoginForm({ notice }: { notice?: string }) {
  const id = useFormIds();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  function onSubmit(values: LoginValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await login(values);
      if (!result.ok) {
        setServerError(result.error);
        return; // os campos continuam preenchidos
      }
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {(notice || serverError) && (
        <p role="alert" className="rounded-xl bg-nude px-4 py-3 text-sm text-cocoa">
          {serverError ?? notice}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor={id("email")}>E-mail</Label>
        <Input
          id={id("email")}
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? `${id("email")}-erro` : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id={id("email-erro")} className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("password")}>Senha</Label>
        <div className="relative">
          <Input
            id={id("password")}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="pr-12"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? `${id("senha")}-erro` : undefined}
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
        {errors.password && (
          <p id={id("senha-erro")} className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      <Controller
        control={control}
        name="remember"
        render={({ field }) => (
          <div className="flex min-h-11 items-center gap-3">
            <Checkbox
              id={id("remember")}
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
            <Label htmlFor={id("remember")} className="text-[0.95rem] font-normal">
              Lembrar de mim neste aparelho
            </Label>
          </div>
        )}
      />

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
        {isPending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
