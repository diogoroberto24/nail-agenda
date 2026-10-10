import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeStep } from "./time-step";
import { readDraft, WithDraft } from "./wizard-test-utils";
import { zonedDateTimeToUtc } from "@/lib/timezone";

const push = vi.fn();
const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

const listBusyWeekAction = vi.fn();
vi.mock("@/app/(app)/agendamentos/actions", () => ({
  listBusyWeekAction: (...args: unknown[]) => listBusyWeekAction(...args),
}));

const TODAY = "2026-11-10"; // terça-feira
const NOW = zonedDateTimeToUtc(TODAY, "10:15").toISOString();
const client = { id: "c1", name: "Maria", phone: "(11) 99999-8888" };
const service = { id: "s1", name: "Esmaltação", durationMinutes: 40, price: 50 };
const full = { client, service, durationMinutes: "40", price: "50,00" };

function setup(patch: object = full) {
  const user = userEvent.setup();
  render(
    <WithDraft patch={patch}>
      <TimeStep today={TODAY} nowIso={NOW} />
    </WithDraft>,
  );
  return { user, draft: () => readDraft(screen.getByTestId("draft")) };
}

const continuar = () => screen.getByRole("button", { name: /Continuar/ });

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  search = "";
  listBusyWeekAction.mockReset();
  listBusyWeekAction.mockResolvedValue([]);
});

describe("TimeStep (etapa 3)", () => {
  it("sem serviço escolhido (página recarregada), volta à primeira etapa incompleta", async () => {
    setup({});
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/agendamentos/novo/cliente"));
  });

  it("mostra a semana de segunda a domingo, com o mês no título", async () => {
    setup();
    expect(await screen.findByText("Novembro 2026")).toBeInTheDocument();
    const days = screen.getByRole("group", { name: "Dias da semana" });
    expect(days.querySelectorAll("button")).toHaveLength(7);
    expect(days.querySelectorAll("button")[0]).toHaveAccessibleName(/Segunda-feira, 9 de novembro/);
  });

  it("dias anteriores a hoje ficam desligados e não dá para voltar a uma semana passada", async () => {
    setup();
    expect(await screen.findByRole("button", { name: /Segunda-feira, 9 de novembro/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Semana anterior" })).toBeDisabled();
  });

  it("sem dia escolhido não há horários nem botão ativo", async () => {
    setup();
    await screen.findByText("Novembro 2026");
    expect(screen.getByText("Escolha um dia para ver os horários.")).toBeInTheDocument();
    expect(continuar()).toBeDisabled();
  });

  it("escolher o dia mostra a grade das 08:00 às 19:30; horários que já passaram ficam desligados hoje", async () => {
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: /Terça-feira, 10 de novembro/ }));
    expect(screen.getByRole("button", { name: "19:30" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "20:00" })).toBeNull();
    expect(screen.getByRole("button", { name: "08:00, já passou" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "10:30" })).toBeEnabled();
  });

  it("escolher horário grava no rascunho e libera o Continuar, que vai ao resumo", async () => {
    const { user, draft } = setup();
    await user.click(await screen.findByRole("button", { name: /Quarta-feira, 11 de novembro/ }));
    await user.click(screen.getByRole("button", { name: "14:00" }));
    expect(draft().date).toBe("2026-11-11");
    expect(draft().time).toBe("14:00");
    expect(screen.getByText(/Termina às 14:40/)).toBeInTheDocument();
    await user.click(continuar());
    expect(push).toHaveBeenCalledWith("/agendamentos/novo/detalhes");
  });

  it("trocar de dia limpa o horário escolhido", async () => {
    const { user, draft } = setup();
    await user.click(await screen.findByRole("button", { name: /Quarta-feira, 11 de novembro/ }));
    await user.click(screen.getByRole("button", { name: "14:00" }));
    await user.click(screen.getByRole("button", { name: /Quinta-feira, 12 de novembro/ }));
    expect(draft().time).toBe("");
    expect(continuar()).toBeDisabled();
  });

  it("horário ocupado aparece marcado, continua escolhível e avisa sem bloquear", async () => {
    listBusyWeekAction.mockResolvedValue([
      { startAt: zonedDateTimeToUtc("2026-11-11", "14:00").toISOString(), endAt: zonedDateTimeToUtc("2026-11-11", "15:00").toISOString() },
    ]);
    const { user, draft } = setup();
    await user.click(await screen.findByRole("button", { name: /Quarta-feira, 11 de novembro/ }));
    const busy = await screen.findByRole("button", { name: "14:00, ocupado" });
    expect(busy).toBeEnabled();
    await user.click(busy);
    expect(draft().time).toBe("14:00");
    expect(screen.getByRole("status")).toHaveTextContent(/já tem um atendimento nesse horário/);
    expect(continuar()).toBeEnabled();
  });

  it("a duração do rascunho define quais horários ficam ocupados", async () => {
    listBusyWeekAction.mockResolvedValue([
      { startAt: zonedDateTimeToUtc("2026-11-11", "10:00").toISOString(), endAt: zonedDateTimeToUtc("2026-11-11", "10:40").toISOString() },
    ]);
    const { user } = setup({ ...full, durationMinutes: "90" });
    await user.click(await screen.findByRole("button", { name: /Quarta-feira, 11 de novembro/ }));
    expect(await screen.findByRole("button", { name: "09:00, ocupado" })).toBeInTheDocument(); // 09:00–10:30 cruza
    expect(screen.getByRole("button", { name: "08:30" })).toBeInTheDocument(); // 08:30–10:00 não cruza
  });

  it("'Outro horário' aceita um horário fora da grade", async () => {
    const { user, draft } = setup();
    await user.click(await screen.findByRole("button", { name: /Quarta-feira, 11 de novembro/ }));
    await user.type(screen.getByLabelText("Outro horário"), "1415");
    expect(draft().time).toBe("14:15");
    expect(continuar()).toBeEnabled();
  });

  it("avançar a semana busca os horários ocupados da semana seguinte", async () => {
    const { user } = setup();
    await screen.findByText("Novembro 2026");
    await waitFor(() => expect(listBusyWeekAction).toHaveBeenCalledWith("2026-11-09"));
    await user.click(screen.getByRole("button", { name: "Próxima semana" }));
    await waitFor(() => expect(listBusyWeekAction).toHaveBeenCalledWith("2026-11-16"));
    expect(screen.getByRole("button", { name: "Semana anterior" })).toBeEnabled();
  });

  it("se a consulta de ocupados falhar, avisa mas deixa escolher", async () => {
    listBusyWeekAction.mockRejectedValue(new Error("x"));
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: /Quarta-feira, 11 de novembro/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível conferir/);
    await user.click(screen.getByRole("button", { name: "14:00" }));
    expect(continuar()).toBeEnabled();
  });

  it("vindo do resumo para editar (?retorno=detalhes), o Continuar volta ao resumo", async () => {
    search = "retorno=detalhes";
    const { user } = setup({ ...full, date: "2026-11-11", time: "14:00" });
    await screen.findByText("Novembro 2026");
    await user.click(continuar());
    expect(push).toHaveBeenCalledWith("/agendamentos/novo/detalhes");
  });
});
