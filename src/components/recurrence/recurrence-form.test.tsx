import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecurrenceForm } from "./recurrence-form";
import { EndRecurrenceButton } from "./end-recurrence-button";
import { RecurrenceTopUp } from "./recurrence-top-up";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh }) }));
const refresh = vi.fn();
vi.mock("@/app/(app)/recorrencias/actions", () => ({
  previewRecurrenceAction: vi.fn(),
  createRecurrenceAction: vi.fn(),
  changeRecurrenceAction: vi.fn(),
  endRecurrenceAction: vi.fn(),
  topUpRecurrencesAction: vi.fn(),
}));

const CLIENT = "11111111-1111-4111-8111-111111111111";
const SERVICE = "22222222-2222-4222-8222-222222222222";
const services = [
  { id: SERVICE, name: "Esmaltação", durationMinutes: 45, price: 50 },
  { id: "33333333-3333-4333-8333-333333333333", name: "Alongamento", durationMinutes: 120, price: 180 },
];

const plan = [
  { date: "2031-12-02", time: "10:00", startAt: "2031-12-02T13:00:00.000Z", endAt: "2031-12-02T13:45:00.000Z", conflict: false },
  { date: "2031-12-09", time: "10:00", startAt: "2031-12-09T13:00:00.000Z", endAt: "2031-12-09T13:45:00.000Z", conflict: true },
  { date: "2031-12-16", time: "10:00", startAt: "2031-12-16T13:00:00.000Z", endAt: "2031-12-16T13:45:00.000Z", conflict: false },
];

function setup(props: Partial<React.ComponentProps<typeof RecurrenceForm>> = {}) {
  const actions = {
    preview: vi.fn().mockResolvedValue({ ok: true, occurrences: plan, conflicts: 1 }),
    create: vi.fn().mockResolvedValue({ ok: true, id: "r1", created: 2 }),
    change: vi.fn().mockResolvedValue({ ok: true, id: "r2", created: 2, cancelled: 1, kept: 0 }),
  } as unknown as NonNullable<React.ComponentProps<typeof RecurrenceForm>["actions"]>;
  const user = userEvent.setup();
  render(
    <RecurrenceForm
      clientId={CLIENT}
      clientName="Maria Silva"
      services={services}
      defaultValues={{ clientId: CLIENT }}
      doneHref="/clientes/c1"
      cancelHref="/clientes/c1"
      actions={actions}
      {...props}
    />,
  );
  return { user, actions };
}

async function fillBasics(user: ReturnType<typeof userEvent.setup>, date = "2031-12-02", time = "10:00") {
  await user.click(screen.getByRole("radio", { name: /Esmaltação/ }));
  await user.type(screen.getByLabelText("Primeiro atendimento"), date);
  await user.type(screen.getByLabelText("Horário"), time);
}

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
});

describe("RecurrenceForm", () => {
  it("campos vazios mostram os erros e não consultam as datas", async () => {
    const { user, actions } = setup();
    await user.click(screen.getByRole("button", { name: "Ver as datas" }));
    expect(await screen.findByText("Escolha o serviço.")).toBeInTheDocument();
    expect(screen.getByText("Informe a data do primeiro atendimento.")).toBeInTheDocument();
    expect(screen.getByText("Informe um horário válido.")).toBeInTheDocument();
    expect(actions.preview).not.toHaveBeenCalled();
  });

  it("escolher o serviço preenche duração e preço padrão", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("radio", { name: /Alongamento/ }));
    expect(screen.getByLabelText(/Duração \(min\)/)).toHaveValue("120");
    expect(screen.getByLabelText(/Preço \(R\$\)/)).toHaveValue("180,00");
  });

  it("três jeitos de repetir: semanal (padrão), mensal e a cada X dias (que pede o X)", async () => {
    const { user, actions } = setup();
    expect(screen.getByRole("radio", { name: "Semanal" })).toBeChecked();
    expect(screen.getByText(/mesmo dia da semana/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Mensal" }));
    expect(screen.getByText(/último dia do mês/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "A cada X dias" }));
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Ver as datas" }));
    expect(await screen.findByText("Informe de quantos em quantos dias (1 a 365).")).toBeInTheDocument();
    expect(actions.preview).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("De quantos em quantos dias"), "10");
    await user.click(screen.getByRole("button", { name: "Ver as datas" }));
    await waitFor(() => expect(actions.preview).toHaveBeenCalled());
    expect((actions.preview as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ frequency: "every_days", intervalDays: "10" });
  });

  it("a data final não pode ser antes do primeiro atendimento", async () => {
    const { user, actions } = setup();
    await fillBasics(user);
    await user.type(screen.getByLabelText(/Data final/), "2031-11-01");
    await user.click(screen.getByRole("button", { name: "Ver as datas" }));
    expect(await screen.findByText("A data final precisa ser depois do primeiro atendimento.")).toBeInTheDocument();
    expect(actions.preview).not.toHaveBeenCalled();
  });

  it("mostra as datas; as que já têm atendimento vêm puladas e avisadas", async () => {
    const { user } = setup();
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Ver as datas" }));
    expect(await screen.findByText("Toda terça-feira, às 10:00")).toBeInTheDocument();
    expect(screen.getByText("2 atendimentos serão criados · 1 data pulada")).toBeInTheDocument();
    const conflito = screen.getByRole("checkbox", { name: /09\/12\/2031/ });
    expect(conflito).toBeChecked();
    expect(screen.getByText("Você já tem atendimento neste horário")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /02\/12\/2031/ })).not.toBeChecked();
  });

  it("dá para criar mesmo assim (desmarcar o conflito) e para pular outra data", async () => {
    const { user } = setup();
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Ver as datas" }));
    await user.click(await screen.findByRole("checkbox", { name: /09\/12\/2031/ })); // criar mesmo assim
    await user.click(screen.getByRole("checkbox", { name: /16\/12\/2031/ })); // pular esta
    expect(screen.getByText("2 atendimentos serão criados · 1 data pulada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar 2 atendimentos" })).toBeEnabled();
  });

  it("criar envia só as datas puladas escolhidas, com o identificador da tentativa, e vai para a ficha", async () => {
    const { user, actions } = setup();
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Ver as datas" }));
    await user.click(await screen.findByRole("button", { name: "Criar 2 atendimentos" }));
    await waitFor(() => expect(actions.create).toHaveBeenCalled());
    const [attempt, values, skipped] = (actions.create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(attempt).toMatch(/^[0-9a-f-]{36}$/);
    expect(values).toMatchObject({ clientId: CLIENT, serviceId: SERVICE, frequency: "weekly", startDate: "2031-12-02", time: "10:00", durationMinutes: "45", price: "50,00" });
    expect(skipped).toEqual(["2031-12-09"]);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/clientes/c1?recorrencia=criada&n=2"));
  });

  it("'Voltar e editar' mantém o que foi preenchido", async () => {
    const { user } = setup();
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Ver as datas" }));
    await user.click(await screen.findByRole("button", { name: "Voltar e editar" }));
    expect(screen.getByLabelText("Primeiro atendimento")).toHaveValue("2031-12-02");
    expect(screen.getByRole("radio", { name: /Esmaltação/ })).toBeChecked();
  });

  it("erro do servidor na conferência é mostrado e os campos continuam", async () => {
    const { user, actions } = setup();
    (actions.preview as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "A data do primeiro atendimento não pode ser passada." });
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Ver as datas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("não pode ser passada");
    expect(screen.getByLabelText("Primeiro atendimento")).toHaveValue("2031-12-02");
  });

  it("erro ao criar volta a mostrar as datas com o aviso", async () => {
    const { user, actions } = setup();
    (actions.create as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "Não foi possível salvar. Tente de novo." });
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Ver as datas" }));
    await user.click(await screen.findByRole("button", { name: "Criar 2 atendimentos" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar");
    expect(push).not.toHaveBeenCalled();
  });

  it("alterar: avisa o que acontece, confere ignorando a série atual e usa a ação de alterar", async () => {
    const { user, actions } = setup({
      changeOfId: "old-1",
      defaultValues: { clientId: CLIENT, serviceId: SERVICE, frequency: "weekly", startDate: "2031-12-02", time: "10:00", durationMinutes: "45", price: "50,00" },
    });
    expect(screen.getByText(/termina na véspera da data escolhida/)).toBeInTheDocument();
    expect(screen.getByLabelText("A partir de")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver as datas" }));
    await waitFor(() => expect(actions.preview).toHaveBeenCalled());
    expect((actions.preview as ReturnType<typeof vi.fn>).mock.calls[0][1]).toEqual({ recurrenceId: "old-1", fromDate: "2031-12-02" });
    await user.click(await screen.findByRole("button", { name: "Alterar e criar 2" }));
    await waitFor(() => expect(actions.change).toHaveBeenCalled());
    expect((actions.change as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("old-1");
    expect(actions.create).not.toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/clientes/c1?recorrencia=alterada&n=2"));
  });

  it("sem serviços ativos explica e não deixa continuar", () => {
    setup({ services: [] });
    expect(screen.getByText(/ainda não tem serviços ativos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver as datas" })).toBeDisabled();
  });
});

describe("EndRecurrenceButton", () => {
  it("pede confirmação antes de encerrar; voltar desiste", async () => {
    const endAction = vi.fn().mockResolvedValue({ ok: true, cancelled: 3, kept: 1 });
    const user = userEvent.setup();
    render(<EndRecurrenceButton recurrenceId="r1" clientId="c1" endAction={endAction} />);
    await user.click(screen.getByRole("button", { name: "Encerrar recorrência" }));
    const dialog = screen.getByRole("alertdialog", { name: "Confirmar encerramento" });
    expect(dialog).toHaveTextContent(/ainda aguardam confirmação serão cancelados/);
    await user.click(within(dialog).getByRole("button", { name: "Voltar" }));
    expect(endAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Encerrar recorrência" })).toBeInTheDocument();
  });

  it("encerrar chama a ação e volta para a ficha com o resumo", async () => {
    const endAction = vi.fn().mockResolvedValue({ ok: true, cancelled: 3, kept: 1 });
    const user = userEvent.setup();
    render(<EndRecurrenceButton recurrenceId="r1" clientId="c1" endAction={endAction} />);
    await user.click(screen.getByRole("button", { name: "Encerrar recorrência" }));
    await user.click(screen.getByRole("button", { name: "Encerrar" }));
    await waitFor(() => expect(endAction).toHaveBeenCalledWith("r1", "c1"));
    expect(push).toHaveBeenCalledWith("/clientes/c1?recorrencia=encerrada&n=3&k=1");
  });

  it("erro ao encerrar é mostrado", async () => {
    const endAction = vi.fn().mockResolvedValue({ ok: false, error: "Recorrência não encontrada ou já encerrada." });
    const user = userEvent.setup();
    render(<EndRecurrenceButton recurrenceId="r1" clientId="c1" endAction={endAction} />);
    await user.click(screen.getByRole("button", { name: "Encerrar recorrência" }));
    await user.click(screen.getByRole("button", { name: "Encerrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("já encerrada");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("RecurrenceTopUp", () => {
  beforeEach(() => window.localStorage.clear());

  it("repõe ao abrir, no máximo uma vez por dia, e atualiza a tela se criou algo", async () => {
    const action = vi.fn().mockResolvedValue({ created: 4 });
    const { unmount } = render(<RecurrenceTopUp action={action} />);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    unmount();
    render(<RecurrenceTopUp action={action} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(action).toHaveBeenCalledTimes(1); // segunda abertura no mesmo dia: não repete
  });

  it("não atualiza a tela quando nada foi criado", async () => {
    const action = vi.fn().mockResolvedValue({ created: 0 });
    render(<RecurrenceTopUp action={action} />);
    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falha na reposição não quebra e tenta de novo na próxima abertura", async () => {
    const action = vi.fn().mockRejectedValue(new Error("rede"));
    const { unmount } = render(<RecurrenceTopUp action={action} />);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    unmount();
    render(<RecurrenceTopUp action={action} />);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
  });
});
