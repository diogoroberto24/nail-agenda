import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientStep } from "./client-step";
import { readDraft, WithDraft } from "./wizard-test-utils";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/app/(app)/agendamentos/actions", () => ({ searchClientsAction: vi.fn() }));
vi.mock("@/app/(app)/clientes/actions", () => ({ createClientAction: vi.fn() }));

type Props = React.ComponentProps<typeof ClientStep>;
type Actions = NonNullable<Props["actions"]>;

const recents = [
  { id: "c1", fullName: "Ana Paula", phone: "(41) 99124-0931" },
  { id: "c2", fullName: "Beatriz Souza", phone: "(41) 99876-5432" },
];

function setup(props: Partial<Props> = {}, actions: Partial<Record<keyof Actions, unknown>> = {}, patch = {}) {
  const acts = {
    search: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ ok: true, id: "new-1" }),
    ...actions,
  } as unknown as Actions;
  const user = userEvent.setup();
  render(
    <WithDraft patch={patch}>
      <ClientStep initialClients={recents} recent actions={acts} {...props} />
    </WithDraft>,
  );
  return { user, acts, draft: () => readDraft(screen.getByTestId("draft")) };
}

const continuar = () => screen.getByRole("button", { name: /Continuar/ });

beforeEach(() => {
  push.mockClear();
  search = "";
});

describe("ClientStep (etapa 1)", () => {
  it("sem busca mostra 'Clientes recentes' com nome e telefone", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Clientes recentes" })).toBeInTheDocument();
    expect(screen.getByText("Ana Paula")).toBeInTheDocument();
    expect(screen.getByText("(41) 99876-5432")).toBeInTheDocument();
  });

  it("sem recentes, a lista de reserva se chama 'Suas clientes'", () => {
    setup({ recent: false });
    expect(screen.getByRole("heading", { name: "Suas clientes" })).toBeInTheDocument();
  });

  it("sem nenhuma cliente cadastrada, avisa e oferece o cadastro", () => {
    setup({ initialClients: [] });
    expect(screen.getByText("Nenhuma cliente cadastrada ainda.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cadastrar nova cliente" })).toBeInTheDocument();
  });

  it("sem cliente escolhida, 'Continuar' fica desativado e explica o que falta", () => {
    setup();
    expect(continuar()).toBeDisabled();
    expect(screen.getByText("Escolha uma cliente para continuar.")).toBeInTheDocument();
  });

  it("tocar na cliente só ESCOLHE (marca e guarda no rascunho): não avança sozinho", async () => {
    const { user, draft } = setup();
    await user.click(screen.getByRole("button", { name: /Beatriz Souza/ }));

    expect(push).not.toHaveBeenCalled();
    expect(draft().client).toEqual({ id: "c2", name: "Beatriz Souza", phone: "(41) 99876-5432" });
    expect(screen.getByRole("button", { name: /Beatriz Souza/ })).toHaveAttribute("aria-pressed", "true");
    expect(continuar()).toBeEnabled();
    expect(screen.queryByText("Escolha uma cliente para continuar.")).toBeNull();
  });

  it("'Continuar' leva ao Serviço", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Beatriz Souza/ }));
    await user.click(continuar());
    expect(push).toHaveBeenCalledWith("/agendamentos/novo/servico");
  });

  it("dá para trocar de escolha antes de continuar", async () => {
    const { user, draft } = setup();
    await user.click(screen.getByRole("button", { name: /Ana Paula/ }));
    await user.click(screen.getByRole("button", { name: /Beatriz Souza/ }));
    expect(draft().client?.id).toBe("c2");
    expect(screen.getByRole("button", { name: /Ana Paula/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("veio do resumo para trocar a cliente: 'Continuar' volta direto ao resumo", async () => {
    search = "retorno=detalhes";
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Ana Paula/ }));
    await user.click(continuar());
    expect(push).toHaveBeenCalledWith("/agendamentos/novo/detalhes");
  });

  it("a cliente já escolhida aparece marcada, com 'Continuar' ativo", async () => {
    setup({}, {}, { client: { id: "c2", name: "Beatriz Souza", phone: "(41) 99876-5432" } });
    const selected = await screen.findByRole("button", { name: /Beatriz Souza/ });
    await waitFor(() => expect(selected).toHaveAttribute("aria-pressed", "true"));
    expect(selected).toHaveTextContent("Selecionada");
    expect(screen.getByRole("button", { name: /Ana Paula/ })).toHaveAttribute("aria-pressed", "false");
    expect(continuar()).toBeEnabled();
  });

  it("a cliente escolhida que não está entre as recentes (ex.: recém-cadastrada) aparece no topo, marcada", async () => {
    setup({}, {}, { client: { id: "novo", name: "Carla Mendes", phone: "(41) 98765-4321" } });
    const items = await screen.findAllByRole("button", { pressed: true });
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Carla Mendes");
    const all = screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"));
    expect(all[0]).toHaveTextContent("Carla Mendes");
    expect(all).toHaveLength(3);
  });

  it("a cliente escolhida que JÁ está entre as recentes não aparece duas vezes", async () => {
    setup({}, {}, { client: { id: "c1", name: "Ana Paula", phone: "(41) 99124-0931" } });
    await screen.findAllByRole("button", { pressed: true });
    expect(screen.getAllByText("Ana Paula")).toHaveLength(1);
  });

  it("busca por nome ou telefone: mostra 'Resultados da busca' e o que foi encontrado", async () => {
    const found = [{ id: "c9", fullName: "Beatriz Oliveira", phone: "(41) 98765-4321" }];
    const { user, acts } = setup({}, { search: vi.fn().mockResolvedValue(found) });
    await user.type(screen.getByLabelText("Buscar cliente por nome ou telefone"), "Beatriz");

    expect(await screen.findByRole("heading", { name: /Resultados da busca/ })).toBeInTheDocument();
    expect(await screen.findByText("Beatriz Oliveira")).toBeInTheDocument();
    expect(screen.queryByText("Ana Paula")).toBeNull();
    expect(acts.search).toHaveBeenLastCalledWith("Beatriz");
  });

  it("escolher uma cliente do resultado da busca também só marca; 'Continuar' avança", async () => {
    const found = [{ id: "c9", fullName: "Beatriz Oliveira", phone: "(41) 98765-4321" }];
    const { user, draft } = setup({}, { search: vi.fn().mockResolvedValue(found) });
    await user.type(screen.getByLabelText("Buscar cliente por nome ou telefone"), "Beatriz");
    await user.click(await screen.findByRole("button", { name: /Beatriz Oliveira/ }));
    expect(push).not.toHaveBeenCalled();
    expect(draft().client?.id).toBe("c9");
    await user.click(continuar());
    expect(push).toHaveBeenCalledWith("/agendamentos/novo/servico");
  });

  it("limpar a busca volta às clientes recentes", async () => {
    const { user } = setup({}, { search: vi.fn().mockResolvedValue([{ id: "c9", fullName: "Zoé", phone: "(41) 90000-0000" }]) });
    await user.type(screen.getByLabelText("Buscar cliente por nome ou telefone"), "Zo");
    await screen.findByText("Zoé");
    await user.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(screen.getByRole("heading", { name: "Clientes recentes" })).toBeInTheDocument();
    expect(screen.getByText("Ana Paula")).toBeInTheDocument();
  });

  it("busca sem resultado: avisa e mantém o cadastro à mão", async () => {
    const { user } = setup({}, { search: vi.fn().mockResolvedValue([]) });
    await user.type(screen.getByLabelText("Buscar cliente por nome ou telefone"), "xyz");
    expect(await screen.findByText("Ninguém encontrada com esse nome ou telefone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cadastrar nova cliente" })).toBeInTheDocument();
  });

  it("falha de conexão na busca: mensagem clara", async () => {
    const { user } = setup({}, { search: vi.fn().mockRejectedValue(new Error("offline")) });
    await user.type(screen.getByLabelText("Buscar cliente por nome ou telefone"), "ana");
    expect(await screen.findByRole("alert")).toHaveTextContent("Verifique a conexão");
  });

  it("cadastro rápido: cria a cliente e a deixa ESCOLHIDA; segue pelo 'Continuar'", async () => {
    const { user, acts, draft } = setup();
    await user.click(screen.getByRole("button", { name: "Cadastrar nova cliente" }));
    expect(screen.queryByRole("button", { name: /Continuar/ })).toBeNull(); // sem rodapé durante o cadastro
    await user.type(screen.getByLabelText("Nome completo"), "Carla Mendes");
    await user.type(screen.getByLabelText("Telefone com DDD"), "41987654321");
    await user.click(screen.getByRole("button", { name: "Cadastrar e escolher" }));

    await waitFor(() => expect(draft().client).toMatchObject({ id: "new-1", name: "Carla Mendes" }));
    expect(acts.create).toHaveBeenCalledWith(expect.objectContaining({ fullName: "Carla Mendes" }), false);
    expect(push).not.toHaveBeenCalled();

    // volta à lista, com a nova cliente marcada no topo e o botão ativo
    expect(screen.queryByLabelText("Nome completo")).toBeNull();
    expect(screen.getByRole("heading", { name: "Clientes recentes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Carla Mendes/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(continuar());
    expect(push).toHaveBeenCalledWith("/agendamentos/novo/servico");
  });

  it("cadastro rápido com telefone repetido: oferece usar a cliente existente (também só escolhe)", async () => {
    const create = vi.fn().mockResolvedValue({ ok: false, code: "duplicate", duplicates: [{ id: "c1", fullName: "Ana Paula", archived: false }] });
    const { user, draft } = setup({}, { create });
    await user.click(screen.getByRole("button", { name: "Cadastrar nova cliente" }));
    await user.type(screen.getByLabelText("Nome completo"), "Ana P");
    await user.type(screen.getByLabelText("Telefone com DDD"), "41991240931");
    await user.click(screen.getByRole("button", { name: "Cadastrar e escolher" }));

    await user.click(await screen.findByRole("button", { name: /Usar Ana Paula/ }));
    expect(push).not.toHaveBeenCalled();
    expect(draft().client?.id).toBe("c1");
    expect(continuar()).toBeEnabled();
  });

  it("cancelar o cadastro volta à lista", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Cadastrar nova cliente" }));
    await user.click(screen.getByRole("button", { name: "Cancelar cadastro" }));
    expect(screen.getByText("Ana Paula")).toBeInTheDocument();
  });

  it("com IA configurada, oferece o atalho 'Agendar por texto'", () => {
    setup({ aiEnabled: true });
    expect(screen.getByRole("link", { name: /Agendar por texto/ })).toHaveAttribute("href", "/agendamentos/novo/texto");
  });

  it("sem IA configurada (ou voltando do resumo), não mostra o atalho", () => {
    setup();
    expect(screen.queryByRole("link", { name: /Agendar por texto/ })).not.toBeInTheDocument();
    search = "retorno=detalhes";
    setup({ aiEnabled: true });
    expect(screen.queryByRole("link", { name: /Agendar por texto/ })).not.toBeInTheDocument();
  });
});
