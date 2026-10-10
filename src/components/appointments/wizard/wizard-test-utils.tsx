import { DraftProvider, useDraft } from "./draft-context";
import type { WizardDraft } from "@/lib/appointments/wizard";

/** Mostra o rascunho como texto, para os testes conferirem. */
export function DraftProbe() {
  const { draft } = useDraft();
  return <pre data-testid="draft">{JSON.stringify(draft)}</pre>;
}

/** Provedor com um rascunho inicial (como estaria ao chegar numa etapa pelo fluxo normal). */
export function WithDraft({ patch = {}, children }: { patch?: Partial<WizardDraft>; children: React.ReactNode }) {
  return (
    <DraftProvider initial={patch}>
      {children}
      <DraftProbe />
    </DraftProvider>
  );
}

export const readDraft = (el: HTMLElement): WizardDraft => JSON.parse(el.textContent ?? "{}");
