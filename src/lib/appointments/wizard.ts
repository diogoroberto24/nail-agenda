import type { SelectedClient } from "@/components/appointments/client-picker";
import { isValidDateString, isValidTimeString } from "@/lib/timezone";

/**
 * Fluxo de novo agendamento em etapas: Cliente → Serviço → Data e horário → Detalhes (resumo) → Sucesso.
 * Cada etapa é uma rota; as escolhas ficam num rascunho compartilhado entre elas.
 */
export type StepId = "cliente" | "servico" | "horario" | "detalhes";

export const WIZARD_BASE = "/agendamentos/novo";

export const WIZARD_STEPS: readonly { id: StepId; number: number; label: string; title: string; subtitle: string }[] = [
  { id: "cliente", number: 1, label: "Cliente", title: "Cliente", subtitle: "Busque por nome ou telefone" },
  { id: "servico", number: 2, label: "Serviço", title: "Serviço", subtitle: "Escolha o serviço desejado" },
  { id: "horario", number: 3, label: "Data e horário", title: "Data e horário", subtitle: "Selecione a data e o horário do atendimento" },
  { id: "detalhes", number: 4, label: "Resumo", title: "Detalhes adicionais", subtitle: "Confira as informações do atendimento" },
];

export type DraftService = { id: string; name: string; durationMinutes: number; price: number };

/** Tudo que a profissional já escolheu. Texto nos campos digitados, como no formulário. */
export type WizardDraft = {
  client: SelectedClient | null;
  service: DraftService | null;
  /** data local "YYYY-MM-DD" (vazia até escolher) */
  date: string;
  /** hora local "HH:mm" (vazia até escolher) */
  time: string;
  durationMinutes: string;
  price: string;
  notes: string;
  /** identificador desta tentativa de agendar: um reenvio igual não duplica o atendimento */
  attemptId: string;
};

export function stepHref(step: StepId, opts: { retorno?: boolean } = {}): string {
  return `${WIZARD_BASE}/${step}${opts.retorno ? "?retorno=detalhes" : ""}`;
}

/** Número da etapa (1 a 4) para a rota atual, ou null se não for uma etapa do fluxo. */
export function stepFromPathname(pathname: string): number | null {
  const slug = pathname.replace(/\/+$/, "").split("/").pop();
  return WIZARD_STEPS.find((s) => s.id === slug && pathname.startsWith(WIZARD_BASE))?.number ?? null;
}

/** Para onde o botão voltar leva: etapa anterior; da primeira, a agenda no dia escolhido. */
export function backHref(step: number, date?: string): string {
  if (step <= 1) return date && isValidDateString(date) ? `/agenda?data=${date}` : "/agenda";
  return stepHref(WIZARD_STEPS[step - 2].id);
}

/** Depois de escolher algo numa etapa: segue para a próxima, ou volta direto ao resumo se veio de lá editar. */
export function nextHref(step: StepId, retornoAoResumo: boolean): string {
  if (retornoAoResumo) return stepHref("detalhes");
  const index = WIZARD_STEPS.findIndex((s) => s.id === step);
  return stepHref(WIZARD_STEPS[Math.min(index + 1, WIZARD_STEPS.length - 1)].id);
}

/**
 * Se faltar algo das etapas ANTERIORES à `step`, devolve a rota da primeira etapa incompleta
 * (por exemplo, ao recarregar a página no meio do fluxo, quando o rascunho se perde). Senão, null.
 */
export function firstIncompleteBefore(step: StepId, draft: WizardDraft): string | null {
  const checks: [StepId, boolean][] = [
    ["cliente", draft.client !== null],
    ["servico", draft.service !== null],
    ["horario", isValidDateString(draft.date) && isValidTimeString(draft.time)],
  ];
  const stop = WIZARD_STEPS.findIndex((s) => s.id === step);
  for (const [id, done] of checks) {
    if (WIZARD_STEPS.findIndex((s) => s.id === id) >= stop) break;
    if (!done) return stepHref(id);
  }
  return null;
}

export function emptyDraft(attemptId: string, initial: Partial<Pick<WizardDraft, "client" | "date" | "time">> = {}): WizardDraft {
  return {
    client: initial.client ?? null,
    service: null,
    date: initial.date ?? "",
    time: initial.time ?? "",
    durationMinutes: "",
    price: "",
    notes: "",
    attemptId,
  };
}

/** Rota da tela de sucesso, mostrada depois de agendar. */
export const SUCCESS_HREF = `${WIZARD_BASE}/sucesso`;

/** O que a tela de sucesso mostra do atendimento recém-criado. */
export type SavedAppointment = {
  id: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  date: string;
  time: string;
  durationMinutes: number;
  price: number;
};
