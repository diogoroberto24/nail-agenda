import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DraftProvider } from "@/components/appointments/wizard/draft-context";
import { WizardChrome } from "@/components/appointments/wizard/wizard-chrome";
import { getCurrentProfessional } from "@/lib/auth/session";

/**
 * Layout do novo agendamento. Fica montado enquanto a profissional passa de uma etapa para outra:
 * por isso o rascunho (DraftProvider) e a moldura (voltar, barra de passos) persistem entre as rotas.
 */
export default function NewAppointmentLayout({ children }: LayoutProps<"/agendamentos/novo">) {
  return (
    <Suspense fallback={<div className="p-5 text-sm text-taupe-soft">Carregando...</div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const me = await getCurrentProfessional();
  if (!me) redirect("/auth/acesso-negado");
  return (
    <DraftProvider professionalName={me.displayName}>
      <WizardChrome professionalName={me.displayName}>{children}</WizardChrome>
    </DraftProvider>
  );
}
