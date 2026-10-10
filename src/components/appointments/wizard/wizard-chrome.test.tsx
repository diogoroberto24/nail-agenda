import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { WizardChrome } from "./wizard-chrome";
import { WithDraft } from "./wizard-test-utils";

let pathname = "/agendamentos/novo/servico";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

function setup(path: string, patch = {}) {
  pathname = path;
  render(
    <WithDraft patch={patch}>
      <WizardChrome professionalName="Profissional 1">
        <p>conteúdo da etapa</p>
      </WizardChrome>
    </WithDraft>,
  );
}

describe("WizardChrome (moldura das etapas)", () => {
  it("mostra título, nome da profissional, barra de passos e o conteúdo", () => {
    setup("/agendamentos/novo/servico");
    expect(screen.getByRole("heading", { level: 1, name: "Novo agendamento" })).toBeInTheDocument();
    expect(screen.getByText("Profissional 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "2. Serviço" })).toBeInTheDocument();
    expect(screen.getByText("Escolha o serviço desejado")).toBeInTheDocument();
    expect(screen.getByText("conteúdo da etapa")).toBeInTheDocument();
  });

  it("a barra tem 4 passos: o atual marcado, o anterior com link para voltar, os próximos sem link", () => {
    setup("/agendamentos/novo/servico");
    const steps = screen.getByRole("navigation", { name: "Etapas do agendamento" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(4);
    expect(steps.querySelector('[aria-current="step"]')).toHaveTextContent("Serviço");

    const back = within(steps).getByRole("link", { name: /Cliente: concluída/ });
    expect(back).toHaveAttribute("href", "/agendamentos/novo/cliente");
    expect(within(steps).getAllByRole("link")).toHaveLength(1);
    expect(within(steps).getByText("Data e horário")).toBeInTheDocument();
    expect(within(steps).getByText("Resumo")).toBeInTheDocument();
  });

  it("na etapa 4 as três anteriores viram links; o título é 'Detalhes adicionais'", () => {
    setup("/agendamentos/novo/detalhes");
    const steps = screen.getByRole("navigation", { name: "Etapas do agendamento" });
    expect(within(steps).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/agendamentos/novo/cliente",
      "/agendamentos/novo/servico",
      "/agendamentos/novo/horario",
    ]);
    expect(screen.getByRole("heading", { level: 2, name: "4. Detalhes adicionais" })).toBeInTheDocument();
  });

  it("o botão voltar leva à etapa anterior", () => {
    setup("/agendamentos/novo/horario");
    expect(screen.getByRole("link", { name: "Voltar para Serviço" })).toHaveAttribute("href", "/agendamentos/novo/servico");
  });

  it("na primeira etapa, voltar leva à agenda no dia escolhido", async () => {
    setup("/agendamentos/novo/cliente", { date: "2026-11-10" });
    expect(await screen.findByRole("link", { name: "Voltar para a agenda" })).toHaveAttribute("href", "/agenda?data=2026-11-10");
  });

  it("na entrada do fluxo (que não é etapa), mostra só o conteúdo", () => {
    setup("/agendamentos/novo");
    expect(screen.getByText("conteúdo da etapa")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Etapas do agendamento" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
});
