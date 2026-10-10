import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { KeyRound, Mail, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DisplayNameForm, EmailForm, PasswordForm } from "@/components/profile/profile-forms";
import { getCurrentProfessional } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Perfil" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Perfil" description="Seus dados de acesso." backHref="/menu" backLabel="Menu" />
      <Suspense fallback={<div className="px-5 text-sm text-taupe-soft">Carregando...</div>}>
        <Profile />
      </Suspense>
    </>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof UserRound; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-2xl font-semibold text-cocoa">
        <Icon className="size-5 text-rose-deep" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

async function Profile() {
  const me = await getCurrentProfessional();
  if (!me) redirect("/auth/acesso-negado");

  return (
    <div className="space-y-5 px-5">
      <Section icon={UserRound} title="Seu nome">
        <DisplayNameForm initialName={me.displayName} />
      </Section>
      <Section icon={KeyRound} title="Senha">
        <PasswordForm />
      </Section>
      <Section icon={Mail} title="E-mail de acesso">
        <EmailForm currentEmail={me.email ?? ""} />
      </Section>
    </div>
  );
}
