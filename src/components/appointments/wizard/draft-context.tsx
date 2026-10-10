"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { emptyDraft, firstIncompleteBefore, type SavedAppointment, type StepId, type WizardDraft } from "@/lib/appointments/wizard";
import { newUuid } from "@/lib/uuid";

type DraftContextValue = {
  draft: WizardDraft;
  /** altera alguns campos do rascunho */
  update: (patch: Partial<WizardDraft>) => void;
  /** começa um agendamento novo: rascunho vazio e uma tentativa nova (identificador diferente) */
  reset: (initial?: Parameters<typeof emptyDraft>[1]) => void;
  /** nome da profissional logada (todo agendamento do fluxo é dela) */
  professionalName: string;
  /** o atendimento recém-criado, mostrado na tela de sucesso (null enquanto nada foi salvo) */
  saved: SavedAppointment | null;
  setSaved: (saved: SavedAppointment | null) => void;
};

const DraftContext = createContext<DraftContextValue | null>(null);

/**
 * Guarda as escolhas do novo agendamento enquanto a profissional passa de uma etapa para outra.
 * Vive no layout do fluxo, então persiste entre as rotas das etapas. Recarregar a página o apaga:
 * por isso cada etapa confere o que falta (useStepGuard).
 */
export function DraftProvider({
  children,
  initial,
  professionalName = "",
}: {
  children: React.ReactNode;
  initial?: Partial<WizardDraft>;
  professionalName?: string;
}) {
  const [draft, setDraft] = useState<WizardDraft>(() => ({ ...emptyDraft(newUuid()), ...initial }));

  const update = useCallback((patch: Partial<WizardDraft>) => setDraft((d) => ({ ...d, ...patch })), []);
  const [saved, setSaved] = useState<SavedAppointment | null>(null);
  const reset = useCallback((initial?: Parameters<typeof emptyDraft>[1]) => {
    setDraft(emptyDraft(newUuid(), initial));
    setSaved(null);
  }, []);

  const value = useMemo(() => ({ draft, update, reset, professionalName, saved, setSaved }), [draft, update, reset, professionalName, saved]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftContextValue {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft precisa estar dentro de DraftProvider.");
  return ctx;
}

/**
 * Garante que as etapas anteriores estejam preenchidas. Se não estiverem (por exemplo, a página foi
 * recarregada no meio do fluxo), leva para a primeira etapa incompleta.
 * Devolve true quando a etapa já pode ser mostrada.
 */
export function useStepGuard(step: StepId): boolean {
  const { draft } = useDraft();
  const router = useRouter();
  const target = firstIncompleteBefore(step, draft);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  return target === null;
}
