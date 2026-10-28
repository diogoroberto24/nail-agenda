import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextBooking } from "./text-booking";
import { readDraft, WithDraft } from "./wizard-test-utils";
import type { BookingSuggestion } from "@/lib/ai/booking-types";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/(app)/agendamentos/novo/texto/actions", () => ({ interpretBookingTextAction: vi.fn() }));

const ana = { id: "c-ana", name: "Ana Paula", phone: "(41) 99124-0931" };
const anaClara = { id: "c-ana-clara", name: "Ana Clara", phone: "(41) 98888-1111" };
const pedicure = { id: "s-pe-mao", name: "Manicure e pedicure", durationMinutes: 90, price: 70 };

const base: BookingSuggestion = {
  client: null,
  clientCandidates: [],
  clientQuery: null,
  service: null,
  date: "",
  time: "",
  notes: "",
  warnings: [],
};

function setup(suggestion: Partial<BookingSuggestion> | { error: string }) {
  const interpret = vi
    .fn()
    .mockResolvedValue("error" in suggestion ? { ok: false, error: suggestion.error } : { ok: true, suggestion: { ...base, ...suggestion } });
  const user = userEvent.setup();
  render(
    <WithDraft>
      <TextBooking interpret={interpret} />
    </WithDraft>,
  );
  return { user, interpret };
}

async function describeAndInterpret(user: ReturnType<typeof userEvent.setup>, text = "Ana sexta 14h pé e mão") {
  await user.type(screen.getByLabelText("Descreva o agendamento"), text);
  await user.click(screen.getByRole("button", { name: "Interpretar" }));
}

describe("TextBooking", () => {
  beforeEach(() => push.mockReset());

  it("mostra o que foi entendido e leva ao resumo com o rascunho preenchido", async () => {
    const { user, interpret } = setup({ client: ana, service: pedicure, date: "2026-10-30", time: "14:00", notes: "traz a filha" });
    await describeAndInterpret(user);

    expect(interpret).toHaveBeenCalledWith("Ana sexta 14h pé e mão");
    expect(await screen.findByText("Entendi assim")).toBeInTheDocument();
    expect(screen.getByText("Ana Paula")).toBeInTheDocument();
    expect(screen.getByText("Manicure e pedicure")).toBeInTheDocument();
    expect(screen.getByText(/Sexta-feira, 30 de outubro.*14:00/i)).toBeInTheDocument();
    expect(screen.getByText(/Nada foi agendado ainda/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Revisar e agendar/ }));

    expect(push).toHaveBeenCalledWith("/agendamentos/novo/detalhes");
    expect(readDraft(screen.getByTestId("draft"))).toMatchObject({
      client: ana,
      service: pedicure,
      date: "2026-10-30",
      time: "14:00",
      durationMinutes: "90",
      price: "70,00",
      notes: "traz a filha",
    });
  });

  it("com mais de uma cliente possível, pede para escolher", async () => {
    const { user } = setup({ clientCandidates: [ana, anaClara], clientQuery: "Ana", service: pedicure });
    await describeAndInterpret(user);

    expect(await screen.findByText("Encontrei mais de uma. Qual é?")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Ana Clara" }));
    expect(screen.getByRole("radio", { name: "Ana Clara" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("button", { name: /Revisar e agendar/ }));
    // falta data e horário: segue para essa etapa, com cliente e serviço já escolhidos
    expect(push).toHaveBeenCalledWith("/agendamentos/novo/horario");
    expect(readDraft(screen.getByTestId("draft")).client).toEqual(anaClara);
  });

  it("sem cliente identificada, segue para a etapa de cliente", async () => {
    const { user } = setup({ clientQuery: "Fernanda", date: "2026-10-30", time: "14:00" });
    await describeAndInterpret(user);

    expect(await screen.findByText(/Não encontrei "Fernanda"/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Revisar e agendar/ }));
    expect(push).toHaveBeenCalledWith("/agendamentos/novo/cliente");
  });

  it("mostra os avisos de conferência", async () => {
    const { user } = setup({ client: ana, date: "2026-10-27", warnings: ["A data entendida já passou. Confira antes de agendar."] });
    await describeAndInterpret(user);
    expect(await screen.findByText(/A data entendida já passou/)).toBeInTheDocument();
  });

  it("quando nada foi entendido, não oferece continuar", async () => {
    const { user } = setup({});
    await describeAndInterpret(user, "oi");
    expect(await screen.findByText(/Não consegui identificar o agendamento/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Revisar e agendar/ })).not.toBeInTheDocument();
  });

  it("mostra o erro da IA sem quebrar a tela", async () => {
    const { user } = setup({ error: "O limite de uso da IA foi atingido." });
    await describeAndInterpret(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("O limite de uso da IA foi atingido.");
  });

  it("os exemplos preenchem o campo", async () => {
    const { user } = setup({});
    await user.click(screen.getByRole("button", { name: "Ana amanhã 14h pé e mão" }));
    expect(screen.getByLabelText("Descreva o agendamento")).toHaveValue("Ana amanhã 14h pé e mão");
  });
});
