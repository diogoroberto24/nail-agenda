import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentForm, type ServiceOption } from "./appointment-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/(app)/agendamentos/actions", () => ({
  checkConflictsAction: vi.fn(),
  createAppointmentAction: vi.fn(),
  updateAppointmentAction: vi.fn(),
  searchClientsAction: vi.fn(),
}));
vi.mock("@/app/(app)/clientes/actions", () => ({ createClientAction: vi.fn() }));

const CLIENT_ID = "30000000-0000-0000-0000-000000000001";
const SERVICE_A = "40000000-0000-0000-0000-00000000000a";
const SERVICE_B = "40000000-0000-0000-0000-00000000000b";

const services: ServiceOption[] = [
  { id: SERVICE_A, name: "Esmaltação", durationMinutes: 40, price: 50, active: true },
  { id: SERVICE_B, name: "Alongamento", durationMinutes: 120, price: 180, active: true },
];

type Props = React.ComponentProps<typeof AppointmentForm>;
type Actions = NonNullable<Props["actions"]>;

function setup(overrides: Partial<Actions> = {}, props: Partial<Props> = {}) {
  const actions = {
    create: vi.fn().mockResolvedValue({ ok: true, id: "a-1", date: "2031-03-10" }),
    update: vi.fn().mockResolvedValue({ ok: true, id: "a-1", date: "2031-03-10" }),
    checkConflicts: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as Actions;
  const pickerActions = {
    search: vi.fn().mockResolvedValue([{ id: CLIENT_ID, fullName: "Maria Silva", phone: "(11) 99999-8888" }]),
    create: vi.fn(),
  } as unknown as Props["pickerActions"];
  const user = userEvent.setup();
  render(
    <AppointmentForm
      professionalName="Ana"
      services={services}
      initialClient={null}
      defaultValues={{ date: "2031-03-10", time: "" }}
      cancelHref="/agenda"
      actions={actions}
      pickerActions={pickerActions}
      {...props}
    />,
  );
  return { actions, pickerActions, user };
}

async function pickClient(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /Maria Silva/ }));
}

beforeEach(() => push.mockClear());

describe("AppointmentForm", () => {
  it("mostra de quem é o atendimento", () => {
    setup();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("não envia sem cliente, serviço e horário, e mostra os erros junto dos campos", async () => {
    const { actions, user } = setup();
    await user.click(screen.getByRole("button", { name: "Agendar" }));
    expect(await screen.findByText("Escolha a cliente.")).toBeInTheDocument();
    expect(screen.getByText("Escolha o serviço.")).toBeInTheDocument();
    expect(screen.getByText("Informe um horário válido.")).toBeInTheDocument();
    expect(actions.create).not.toHaveBeenCalled();
  });

  it("escolher o serviço preenche duração e preço; o término é calculado", async () => {
    const { user } = setup();
    await pickClient(user);
    await user.click(screen.getByRole("radio", { name: /Esmaltação/ }));
    expect(screen.getByLabelText(/Duração/)).toHaveValue("40");
    expect(screen.getByLabelText(/Preço/)).toHaveValue("50,00");

    await user.type(screen.getByLabelText("Horário"), "10:00");
    const resumo = screen.getByRole("region", { name: "Resumo" });
    expect(resumo).toHaveTextContent("Maria Silva");
    expect(resumo).toHaveTextContent("Esmaltação");
    expect(resumo).toHaveTextContent("10/03/2031 às 10:00");
    expect(resumo).toHaveTextContent("10:40");
    expect(resumo).toHaveTextContent("R$ 50,00");
  });

  it("ajustar a duração atualiza o término, e trocar de serviço volta ao padrão do novo serviço", async () => {
    const { user } = setup();
    await pickClient(user);
    await user.click(screen.getByRole("radio", { name: /Esmaltação/ }));
    await user.type(screen.getByLabelText("Horário"), "10:00");
    await user.clear(screen.getByLabelText(/Duração/));
    await user.type(screen.getByLabelText(/Duração/), "75");
    expect(screen.getByRole("region", { name: "Resumo" })).toHaveTextContent("11:15");

    await user.click(screen.getByRole("radio", { name: /Alongamento/ }));
    expect(screen.getByLabelText(/Duração/)).toHaveValue("120");
    expect(screen.getByRole("region", { name: "Resumo" })).toHaveTextContent("12:00");
  });

  it("atendimento que passa da meia-noite mostra a data do término", async () => {
    const { user } = setup();
    await pickClient(user);
    await user.click(screen.getByRole("radio", { name: /Alongamento/ }));
    await user.type(screen.getByLabelText("Horário"), "23:30");
    expect(screen.getByRole("region", { name: "Resumo" })).toHaveTextContent("11/03/2031 às 01:30");
  });

  it("envia os dados e abre a agenda no dia, com o atendimento em destaque", async () => {
    const { actions, user } = setup();
    await pickClient(user);
    await user.click(screen.getByRole("radio", { name: /Esmaltação/ }));
    await user.type(screen.getByLabelText("Horário"), "10:00");
    await user.click(screen.getByRole("button", { name: "Agendar" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/agenda?data=2031-03-10&destaque=a-1"));
    const [attemptId, sent, confirm] = (actions.create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(attemptId).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent).toMatchObject({ clientId: CLIENT_ID, serviceId: SERVICE_A, date: "2031-03-10", time: "10:00", durationMinutes: "40", price: "50,00" });
    expect(confirm).toBe(false);
  });

  it("conflito: mostra quem e quando, mantém os campos e só agenda após 'Agendar mesmo assim'", async () => {
    const conflict = { ok: false, code: "conflict", conflicts: [{ id: "x", clientName: "Joana", start: "10:00", end: "10:40" }] };
    const create = vi.fn().mockResolvedValueOnce(conflict).mockResolvedValueOnce({ ok: true, id: "a-2", date: "2031-03-10" });
    const { user } = setup({ create } as Partial<Actions>);
    await pickClient(user);
    await user.click(screen.getByRole("radio", { name: /Esmaltação/ }));
    await user.type(screen.getByLabelText("Horário"), "10:20");
    await user.click(screen.getByRole("button", { name: "Agendar" }));

    expect(await screen.findByText("Você já tem atendimento neste horário.")).toBeInTheDocument();
    expect(screen.getByText(/10:00 às 10:40, Joana/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Horário")).toHaveValue("10:20");

    await user.click(screen.getByRole("button", { name: "Agendar mesmo assim" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/agenda?data=2031-03-10&destaque=a-2"));
    expect(create).toHaveBeenLastCalledWith(expect.any(String), expect.anything(), true);
  });

  it("aviso em tempo real: ao informar horário que conflita, o botão já vira 'Agendar mesmo assim'", async () => {
    const checkConflicts = vi.fn().mockResolvedValue([{ id: "x", clientName: "Joana", start: "10:00", end: "10:40" }]);
    const { user } = setup({ checkConflicts } as Partial<Actions>);
    await pickClient(user);
    await user.click(screen.getByRole("radio", { name: /Esmaltação/ }));
    await user.type(screen.getByLabelText("Horário"), "10:20");

    expect(await screen.findByRole("button", { name: "Agendar mesmo assim" })).toBeInTheDocument();
    expect(checkConflicts).toHaveBeenLastCalledWith(expect.objectContaining({ date: "2031-03-10", time: "10:20", durationMinutes: "40" }));
  });

  it("falha de conexão: mantém tudo preenchido e permite tentar de novo com o MESMO identificador", async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true, id: "a-3", date: "2031-03-10" });
    const { user } = setup({ create } as Partial<Actions>);
    await pickClient(user);
    await user.click(screen.getByRole("radio", { name: /Esmaltação/ }));
    await user.type(screen.getByLabelText("Horário"), "10:00");
    await user.click(screen.getByRole("button", { name: "Agendar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Verifique a conexão");
    expect(screen.getByLabelText("Horário")).toHaveValue("10:00");
    expect(screen.getByRole("radio", { name: /Esmaltação/ })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("button", { name: "Agendar" }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const ids = create.mock.calls.map((c) => c[0]);
    expect(ids[0]).toBe(ids[1]); // reenvio idempotente: nunca cria duplicado
  });

  it("desabilita o botão durante o envio", async () => {
    let finish: (v: unknown) => void = () => {};
    const create = vi.fn().mockReturnValue(new Promise((r) => (finish = r)));
    const { user } = setup({ create } as Partial<Actions>);
    await pickClient(user);
    await user.click(screen.getByRole("radio", { name: /Esmaltação/ }));
    await user.type(screen.getByLabelText("Horário"), "10:00");
    await user.click(screen.getByRole("button", { name: "Agendar" }));

    const busy = await screen.findByRole("button", { name: /Salvando/ });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(create).toHaveBeenCalledTimes(1);
    finish({ ok: true, id: "a-4", date: "2031-03-10" });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it("sem serviços: orienta a cadastrar", () => {
    setup({}, { services: [] });
    expect(screen.getByRole("link", { name: "Cadastrar serviço" })).toHaveAttribute("href", "/servicos/novo");
  });

  it("modo edição: carrega os dados, chama a ação de atualizar e usa o texto 'Salvar alterações'", async () => {
    const { actions, user } = setup(
      {},
      {
        appointmentId: "a-9",
        initialClient: { id: CLIENT_ID, name: "Maria Silva", phone: "(11) 99999-8888" },
        defaultValues: { clientId: CLIENT_ID, serviceId: SERVICE_A, date: "2031-03-10", time: "10:00", durationMinutes: "40", price: "50,00", notes: "" },
      },
    );
    await user.clear(screen.getByLabelText("Horário"));
    await user.type(screen.getByLabelText("Horário"), "11:00");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(actions.update).toHaveBeenCalled());
    expect(actions.update).toHaveBeenCalledWith("a-9", expect.objectContaining({ time: "11:00", serviceId: SERVICE_A }), false);
    expect(actions.create).not.toHaveBeenCalled();
  });

  it("remarcação que devolveu o status para aguardando: a agenda recebe o aviso", async () => {
    const update = vi.fn().mockResolvedValue({ ok: true, id: "a-9", date: "2031-03-10", statusReset: true });
    const { user } = setup(
      { update } as Partial<Actions>,
      {
        appointmentId: "a-9",
        initialClient: { id: CLIENT_ID, name: "Maria Silva", phone: "(11) 99999-8888" },
        defaultValues: { clientId: CLIENT_ID, serviceId: SERVICE_A, date: "2031-03-10", time: "10:00", durationMinutes: "40", price: "50,00", notes: "" },
      },
    );
    await user.clear(screen.getByLabelText("Horário"));
    await user.type(screen.getByLabelText("Horário"), "11:00");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/agenda?data=2031-03-10&destaque=a-9&remarcado=1"));
  });

  it("depois de salvar, o formulário zera e o próximo agendamento usa uma tentativa NOVA (não é tratado como reenvio)", async () => {
    const create = vi.fn().mockResolvedValue({ ok: true, id: "a-1", date: "2031-03-10" });
    const { user } = setup({ create } as Partial<Actions>);
    await pickClient(user);
    await user.click(screen.getByRole("radio", { name: /Esmaltação/ }));
    await user.type(screen.getByLabelText("Horário"), "10:00");
    await user.click(screen.getByRole("button", { name: "Agendar" }));
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));

    // o Next mantém a tela montada: ao voltar, ela precisa estar limpa
    await waitFor(() => expect(screen.getByLabelText("Horário")).toHaveValue(""));
    expect(screen.getByRole("radio", { name: /Esmaltação/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByLabelText(/Duração/)).toHaveValue("");
    expect(screen.getByRole("region", { name: "Resumo" })).not.toHaveTextContent("Maria Silva");
    expect(screen.getByLabelText("Data")).toHaveValue("2031-03-10"); // volta ao dia de partida

    await pickClient(user);
    await user.click(screen.getByRole("radio", { name: /Alongamento/ }));
    await user.type(screen.getByLabelText("Horário"), "15:00");
    await user.click(screen.getByRole("button", { name: "Agendar" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create.mock.calls[1][0]).not.toBe(create.mock.calls[0][0]);
  });

  it("modo edição: salvar NÃO limpa o formulário", async () => {
    const { user } = setup(
      {},
      {
        appointmentId: "a-9",
        initialClient: { id: CLIENT_ID, name: "Maria Silva", phone: "(11) 99999-8888" },
        defaultValues: { clientId: CLIENT_ID, serviceId: SERVICE_A, date: "2031-03-10", time: "10:00", durationMinutes: "40", price: "50,00", notes: "" },
      },
    );
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(screen.getByLabelText("Horário")).toHaveValue("10:00");
  });

  it("trocar a cliente selecionada volta a mostrar a busca", async () => {
    const { user } = setup();
    await pickClient(user);
    expect(screen.queryByLabelText("Buscar cliente por nome ou telefone")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Trocar" }));
    expect(await screen.findByLabelText("Buscar cliente por nome ou telefone")).toBeInTheDocument();
  });
});
