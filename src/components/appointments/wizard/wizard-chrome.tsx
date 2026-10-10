"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronLeft, ClipboardCheck, Sparkles, CalendarClock, UserRound, type LucideIcon } from "lucide-react";
import { useDraft } from "@/components/appointments/wizard/draft-context";
import { backHref, stepFromPathname, stepHref, WIZARD_STEPS } from "@/lib/appointments/wizard";
import { cn } from "@/lib/utils";

const ICONS: Record<number, LucideIcon> = { 1: UserRound, 2: Sparkles, 3: CalendarClock, 4: ClipboardCheck };

/**
 * Moldura comum das etapas: botão voltar, nome da profissional, barra de passos e o título da etapa.
 * Nas rotas que não são etapas (a entrada do fluxo), mostra só o conteúdo.
 */
export function WizardChrome({ professionalName, children }: { professionalName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const step = stepFromPathname(pathname);
  const { draft } = useDraft();

  if (step === null) return <>{children}</>;
  const current = WIZARD_STEPS[step - 1];

  return (
    <>
      <header className="pt-safe flex items-center gap-1 px-3 pt-4">
        <Link
          href={backHref(step, draft.date)}
          aria-label={step === 1 ? "Voltar para a agenda" : `Voltar para ${WIZARD_STEPS[step - 2].label}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-cocoa active:bg-muted"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 text-xl font-semibold leading-tight text-cocoa min-[360px]:text-2xl">Novo agendamento</h1>
        <span
          className="max-w-[38%] shrink-0 truncate rounded-full bg-nude px-3 py-1.5 text-xs font-medium text-cocoa"
          title={`Atendimento de ${professionalName}`}
        >
          {professionalName}
        </span>
      </header>

      <nav aria-label="Etapas do agendamento" className="px-5 pt-3">
        <ol className="relative grid grid-cols-4">
          {/* linha que liga os passos, atrás dos círculos */}
          <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-[1.55rem] h-px bg-border" />
          {WIZARD_STEPS.map((s) => {
            const state = s.number < step ? "done" : s.number === step ? "current" : "todo";
            const Icon = state === "done" ? Check : ICONS[s.number];
            const body = (
              <>
                <span
                  className={cn(
                    "relative flex size-8 items-center justify-center rounded-full border",
                    state === "current" && "border-rose bg-rose text-cocoa",
                    state === "done" && "border-rose bg-card text-rose-deep",
                    state === "todo" && "border-border bg-card text-taupe",
                  )}
                >
                  <Icon className="size-4" strokeWidth={state === "done" ? 2.4 : 1.8} aria-hidden />
                </span>
                <span className={cn("text-[0.7rem] leading-tight", state === "current" ? "font-semibold text-cocoa" : "text-taupe-soft")}>
                  {s.label}
                </span>
              </>
            );
            return (
              <li key={s.id}>
                {state === "done" ? (
                  <Link
                    href={stepHref(s.id)}
                    aria-label={`${s.label}: concluída. Voltar a esta etapa`}
                    className="flex min-h-[4.25rem] flex-col items-center gap-1.5 pt-2 text-center"
                  >
                    {body}
                  </Link>
                ) : (
                  <div
                    aria-current={state === "current" ? "step" : undefined}
                    className="flex min-h-[4.25rem] flex-col items-center gap-1.5 pt-2 text-center"
                  >
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <section aria-labelledby="etapa-titulo" className="px-5 pb-4 pt-5">
        <h2 id="etapa-titulo" className="text-[1.75rem] font-semibold leading-tight text-cocoa">
          {step}. {current.title}
        </h2>
        <p className="mt-1 text-[0.95rem] text-taupe-soft">{current.subtitle}</p>
      </section>

      {children}
    </>
  );
}
