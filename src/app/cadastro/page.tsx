import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10 pt-safe pb-safe">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-nude text-rose-deep">
          <Sparkles className="size-6" strokeWidth={1.6} aria-hidden />
        </span>
        <h1 className="text-4xl font-semibold text-cocoa">Criar conta</h1>
        <p className="mt-1 text-[0.95rem] text-taupe-soft">Cadastre-se para usar a agenda do salão.</p>
      </div>
      <SignupForm />
      <p className="mt-6 text-center text-[0.95rem] text-taupe-soft">
        Já tem conta?{" "}
        <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-rose-deep underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
