import type { Metadata } from "next";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const NOTICES: Record<string, string> = {
  "sem-acesso": "Esta conta não tem acesso ao salão. Fale com a administradora.",
};

/** Lê o aviso da URL (?erro=...) no request; fica atrás de Suspense por causa do Cache Components. */
async function LoginFormWithNotice({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { erro } = await searchParams;
  const notice = typeof erro === "string" ? NOTICES[erro] : undefined;
  return <LoginForm notice={notice} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10 pt-safe pb-safe">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-nude text-rose-deep">
          <Sparkles className="size-6" strokeWidth={1.6} aria-hidden />
        </span>
        <h1 className="text-4xl font-semibold text-cocoa">Nail Agenda</h1>
        <p className="mt-1 text-[0.95rem] text-taupe-soft">Entre para ver sua agenda.</p>
      </div>
      <Suspense fallback={<LoginForm />}>
        <LoginFormWithNotice searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
