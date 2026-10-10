import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientForm } from "./client-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));
// os módulos reais de ações dependem do servidor; os testes injetam as próprias ações
vi.mock("@/app/(app)/clientes/actions", () => ({
  createClientAction: vi.fn(),
  updateClientAction: vi.fn(),
  checkClientPhoneAction: vi.fn(),
}));

type Actions = NonNullable<React.ComponentProps<typeof ClientForm>["actions"]>;

function setup(overrides: Partial<Actions> = {}, props: Partial<React.ComponentProps<typeof ClientForm>> = {}) {
  const actions = {
    create: vi.fn().mockResolvedValue({ ok: true, id: "c-1" }),
    update: vi.fn().mockResolvedValue({ ok: true, id: "c-1" }),
    checkPhone: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as Actions;
  const user = userEvent.setup();
  render(<ClientForm cancelHref="/clientes" actions={actions} {...props} />);
  return { actions, user };
}

async function fill(user: ReturnType<typeof userEvent.setup>, name: string, phone: string) {
  await user.type(screen.getByLabelText(/Nome completo/), name);
  await user.type(screen.getByLabelText(/Telefone com DDD/), phone);
}

beforeEach(() => push.mockClear());

describe("ClientForm", () => {
  it("mostra os erros junto dos campos e não envia dados inválidos", async () => {
    const { actions, user } = setup();
    await user.click(screen.getByRole("button", { name: "Cadastrar cliente" }));
    expect(await screen.findByText("Informe o nome completo.")).toBeInTheDocument();
    expect(screen.getByText("Informe o telefone com DDD.")).toBeInTheDocument();
    expect(actions.create).not.toHaveBeenCalled();
  });

  it("recusa telefone inválido", async () => {
    const { actions, user } = setup();
    await fill(user, "Maria Silva", "12345");
    await user.click(screen.getByRole("button", { name: "Cadastrar cliente" }));
    expect(await screen.findByText(/Telefone inválido/)).toBeInTheDocument();
    expect(actions.create).not.toHaveBeenCalled();
  });

  it("envia os dados e abre a ficha com o aviso de salvo", async () => {
    const { actions, user } = setup();
    await fill(user, "Maria Silva", "11999998888");
    await user.type(screen.getByLabelText(/Observações/), "alérgica");
    await user.click(screen.getByRole("button", { name: "Cadastrar cliente" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/clientes/c-1?salvo=1"));
    expect(actions.create).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: "Maria Silva", phone: expect.stringContaining("99999"), notes: "alérgica" }),
      false,
    );
  });

  it("depois de cadastrar, o formulário zera (o Next mantém a tela montada); na edição não zera", async () => {
    const { user } = setup();
    await fill(user, "Maria Silva", "11999998888");
    await user.click(screen.getByRole("button", { name: "Cadastrar cliente" }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText(/Nome completo/)).toHaveValue(""));
    expect(screen.getByLabelText(/Telefone com DDD/)).toHaveValue("");
  });

  it("ao sair do telefone: formata o número e avisa se já existe cadastro", async () => {
    const { actions, user } = setup({
      checkPhone: vi.fn().mockResolvedValue([{ id: "c-9", fullName: "Joana Souza", archived: false }]),
    });
    await user.type(screen.getByLabelText(/Telefone com DDD/), "11999998888");
    await user.tab();

    expect(await screen.findByText("Este telefone já está cadastrado.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Telefone com DDD/)).toHaveValue("(11) 99999-8888");
    expect(actions.checkPhone).toHaveBeenCalledWith("(11) 99999-8888".replace(/\D/g, ""), undefined);
    const link = screen.getByRole("link", { name: /Abrir cadastro de Joana Souza/ });
    expect(link).toHaveAttribute("href", "/clientes/c-9");
  });

  it("telefone duplicado no envio: avisa e só cadastra após confirmar", async () => {
    const duplicate = { ok: false, code: "duplicate", duplicates: [{ id: "c-9", fullName: "Joana Souza", archived: true }] };
    const create = vi.fn().mockResolvedValueOnce(duplicate).mockResolvedValueOnce({ ok: true, id: "c-2" });
    const { user } = setup({ create } as Partial<Actions>);
    await fill(user, "Maria Silva", "11999998888");
    await user.click(screen.getByRole("button", { name: "Cadastrar cliente" }));

    expect(await screen.findByText("Este telefone já está cadastrado.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Joana Souza \(arquivada\)/ })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    // os campos continuam preenchidos
    expect(screen.getByLabelText(/Nome completo/)).toHaveValue("Maria Silva");

    await user.click(screen.getByRole("button", { name: "Cadastrar mesmo assim" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/clientes/c-2?salvo=1"));
    expect(create).toHaveBeenLastCalledWith(expect.anything(), true);
  });

  it("erro do servidor: mostra a mensagem e mantém os campos", async () => {
    const { user } = setup({
      create: vi.fn().mockResolvedValue({ ok: false, code: "error", error: "Não foi possível salvar. Tente de novo." }),
    } as Partial<Actions>);
    await fill(user, "Maria Silva", "11999998888");
    await user.click(screen.getByRole("button", { name: "Cadastrar cliente" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar");
    expect(screen.getByLabelText(/Nome completo/)).toHaveValue("Maria Silva");
    expect(push).not.toHaveBeenCalled();
  });

  it("falha de conexão: mantém os campos e permite tentar de novo", async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ ok: true, id: "c-3" });
    const { user } = setup({ create } as Partial<Actions>);
    await fill(user, "Maria Silva", "11999998888");
    await user.click(screen.getByRole("button", { name: "Cadastrar cliente" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Verifique a conexão");
    expect(screen.getByLabelText(/Nome completo/)).toHaveValue("Maria Silva");

    await user.click(screen.getByRole("button", { name: "Cadastrar cliente" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/clientes/c-3?salvo=1"));
  });

  it("desabilita o botão durante o envio (sem envio duplicado)", async () => {
    let finish: (v: unknown) => void = () => {};
    const create = vi.fn().mockReturnValue(new Promise((r) => (finish = r)));
    const { user } = setup({ create } as Partial<Actions>);
    await fill(user, "Maria Silva", "11999998888");
    await user.click(screen.getByRole("button", { name: "Cadastrar cliente" }));

    const busy = await screen.findByRole("button", { name: /Salvando/ });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(create).toHaveBeenCalledTimes(1);

    finish({ ok: true, id: "c-4" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/clientes/c-4?salvo=1"));
  });

  it("modo edição: preenche os dados e chama a ação de atualizar", async () => {
    const { actions, user } = setup(
      {},
      { clientId: "c-7", defaultValues: { fullName: "Ana Costa", phone: "(11) 98888-7777", notes: "" } },
    );
    expect(screen.getByLabelText(/Nome completo/)).toHaveValue("Ana Costa");
    await user.clear(screen.getByLabelText(/Nome completo/));
    await user.type(screen.getByLabelText(/Nome completo/), "Ana Costa Lima");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(actions.update).toHaveBeenCalled());
    expect(actions.update).toHaveBeenCalledWith("c-7", expect.objectContaining({ fullName: "Ana Costa Lima" }), false);
    expect(actions.create).not.toHaveBeenCalled();
  });
});
