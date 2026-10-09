import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceForm } from "./service-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/(app)/servicos/actions", () => ({
  createServiceAction: vi.fn(),
  updateServiceAction: vi.fn(),
}));

type Actions = NonNullable<React.ComponentProps<typeof ServiceForm>["actions"]>;

function setup(overrides: Partial<Actions> = {}, props: Partial<React.ComponentProps<typeof ServiceForm>> = {}) {
  const actions = {
    create: vi.fn().mockResolvedValue({ ok: true, id: "s-1" }),
    update: vi.fn().mockResolvedValue({ ok: true, id: "s-1" }),
    ...overrides,
  } as unknown as Actions;
  const user = userEvent.setup();
  render(<ServiceForm cancelHref="/servicos" actions={actions} {...props} />);
  return { actions, user };
}

beforeEach(() => push.mockClear());

describe("ServiceForm", () => {
  it("mostra os erros dos campos obrigatórios", async () => {
    const { actions, user } = setup();
    await user.click(screen.getByRole("button", { name: "Cadastrar serviço" }));
    expect(await screen.findByText("Informe o nome do serviço.")).toBeInTheDocument();
    expect(screen.getByText("Informe a duração em minutos.")).toBeInTheDocument();
    expect(screen.getByText("Informe o preço.")).toBeInTheDocument();
    expect(actions.create).not.toHaveBeenCalled();
  });

  it("recusa duração e preço inválidos", async () => {
    const { actions, user } = setup();
    await user.type(screen.getByLabelText("Nome do serviço"), "Esmaltação");
    await user.type(screen.getByLabelText(/Duração padrão/), "2");
    await user.type(screen.getByLabelText(/Preço padrão/), "abc");
    await user.click(screen.getByRole("button", { name: "Cadastrar serviço" }));
    expect(await screen.findByText(/entre 5 e 720 minutos/)).toBeInTheDocument();
    expect(screen.getByText(/Preço inválido/)).toBeInTheDocument();
    expect(actions.create).not.toHaveBeenCalled();
  });

  it("os botões de duração comum preenchem o campo", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "90 min" }));
    expect(screen.getByLabelText(/Duração padrão/)).toHaveValue("90");
  });

  it("cadastra o serviço e volta para a lista com o aviso de salvo", async () => {
    const { actions, user } = setup();
    await user.type(screen.getByLabelText("Nome do serviço"), "Esmaltação");
    await user.type(screen.getByLabelText(/Duração padrão/), "40");
    await user.type(screen.getByLabelText(/Preço padrão/), "50,00");
    await user.click(screen.getByRole("button", { name: "Cadastrar serviço" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/servicos?salvo=1"));
    expect(actions.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Esmaltação", durationMinutes: "40", price: "50,00" }),
    );
  });

  it("falha de conexão: mantém os campos", async () => {
    const { user } = setup({ create: vi.fn().mockRejectedValue(new Error("offline")) } as Partial<Actions>);
    await user.type(screen.getByLabelText("Nome do serviço"), "Esmaltação");
    await user.type(screen.getByLabelText(/Duração padrão/), "40");
    await user.type(screen.getByLabelText(/Preço padrão/), "50");
    await user.click(screen.getByRole("button", { name: "Cadastrar serviço" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Verifique a conexão");
    expect(screen.getByLabelText("Nome do serviço")).toHaveValue("Esmaltação");
    expect(push).not.toHaveBeenCalled();
  });

  it("modo edição: carrega os valores e chama a ação de atualizar", async () => {
    const { actions, user } = setup(
      {},
      { serviceId: "s-9", defaultValues: { name: "Alongamento", description: "", durationMinutes: "120", price: "180,00" } },
    );
    expect(screen.getByLabelText(/Duração padrão/)).toHaveValue("120");
    await user.clear(screen.getByLabelText(/Preço padrão/));
    await user.type(screen.getByLabelText(/Preço padrão/), "200");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(actions.update).toHaveBeenCalled());
    expect(actions.update).toHaveBeenCalledWith("s-9", expect.objectContaining({ price: "200", durationMinutes: "120" }));
    expect(actions.create).not.toHaveBeenCalled();
  });
});
