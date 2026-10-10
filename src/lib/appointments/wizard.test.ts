import { describe, expect, it } from "vitest";
import { backHref, emptyDraft, firstIncompleteBefore, nextHref, stepFromPathname, stepHref, WIZARD_STEPS, type WizardDraft } from "./wizard";

const client = { id: "c1", name: "Maria", phone: "(11) 99999-8888" };
const service = { id: "s1", name: "Esmaltação", durationMinutes: 45, price: 50 };

const draft = (over: Partial<WizardDraft> = {}): WizardDraft => ({ ...emptyDraft("att-1"), ...over });

describe("etapas do novo agendamento", () => {
  it("são 4 etapas, na ordem Cliente, Serviço, Data e horário, Resumo", () => {
    expect(WIZARD_STEPS.map((s) => s.number)).toEqual([1, 2, 3, 4]);
    expect(WIZARD_STEPS.map((s) => s.label)).toEqual(["Cliente", "Serviço", "Data e horário", "Resumo"]);
    expect(WIZARD_STEPS[3].title).toBe("Detalhes adicionais");
  });

  it("monta os links de cada etapa (com ou sem retorno ao resumo)", () => {
    expect(stepHref("cliente")).toBe("/agendamentos/novo/cliente");
    expect(stepHref("horario", { retorno: true })).toBe("/agendamentos/novo/horario?retorno=detalhes");
  });

  it("descobre a etapa pela rota, e ignora o que não é etapa", () => {
    expect(stepFromPathname("/agendamentos/novo/cliente")).toBe(1);
    expect(stepFromPathname("/agendamentos/novo/servico/")).toBe(2);
    expect(stepFromPathname("/agendamentos/novo/horario")).toBe(3);
    expect(stepFromPathname("/agendamentos/novo/detalhes")).toBe(4);
    expect(stepFromPathname("/agendamentos/novo")).toBeNull();
    expect(stepFromPathname("/agenda/cliente")).toBeNull();
    expect(stepFromPathname("/clientes")).toBeNull();
  });
});

describe("voltar e avançar", () => {
  it("voltar leva à etapa anterior; da primeira, à agenda (no dia escolhido, se houver)", () => {
    expect(backHref(2)).toBe("/agendamentos/novo/cliente");
    expect(backHref(4)).toBe("/agendamentos/novo/horario");
    expect(backHref(1)).toBe("/agenda");
    expect(backHref(1, "2026-11-10")).toBe("/agenda?data=2026-11-10");
    expect(backHref(1, "lixo")).toBe("/agenda");
  });

  it("avançar leva à próxima etapa; vindo do resumo para editar, volta direto ao resumo", () => {
    expect(nextHref("cliente", false)).toBe("/agendamentos/novo/servico");
    expect(nextHref("servico", false)).toBe("/agendamentos/novo/horario");
    expect(nextHref("horario", false)).toBe("/agendamentos/novo/detalhes");
    expect(nextHref("cliente", true)).toBe("/agendamentos/novo/detalhes");
    expect(nextHref("servico", true)).toBe("/agendamentos/novo/detalhes");
  });
});

describe("rascunho incompleto (recarregar no meio do fluxo)", () => {
  it("a primeira etapa nunca exige nada", () => {
    expect(firstIncompleteBefore("cliente", draft())).toBeNull();
  });

  it("sem cliente, qualquer etapa seguinte volta para Cliente", () => {
    for (const step of ["servico", "horario", "detalhes"] as const) {
      expect(firstIncompleteBefore(step, draft())).toBe("/agendamentos/novo/cliente");
    }
  });

  it("com cliente e sem serviço, Data e Resumo voltam para Serviço", () => {
    expect(firstIncompleteBefore("servico", draft({ client }))).toBeNull();
    expect(firstIncompleteBefore("horario", draft({ client }))).toBe("/agendamentos/novo/servico");
    expect(firstIncompleteBefore("detalhes", draft({ client }))).toBe("/agendamentos/novo/servico");
  });

  it("o Resumo exige data e horário válidos", () => {
    const base = draft({ client, service });
    expect(firstIncompleteBefore("horario", base)).toBeNull();
    expect(firstIncompleteBefore("detalhes", base)).toBe("/agendamentos/novo/horario");
    expect(firstIncompleteBefore("detalhes", { ...base, date: "2026-11-10", time: "" })).toBe("/agendamentos/novo/horario");
    expect(firstIncompleteBefore("detalhes", { ...base, date: "2026-02-30", time: "10:00" })).toBe("/agendamentos/novo/horario");
    expect(firstIncompleteBefore("detalhes", { ...base, date: "2026-11-10", time: "10:00" })).toBeNull();
  });

  it("o rascunho novo começa vazio, com a tentativa informada e valores iniciais opcionais", () => {
    expect(emptyDraft("a-9")).toMatchObject({ client: null, service: null, date: "", time: "", notes: "", attemptId: "a-9" });
    expect(emptyDraft("a-9", { client, date: "2026-11-10", time: "09:30" })).toMatchObject({ client, date: "2026-11-10", time: "09:30" });
  });
});
