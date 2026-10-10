import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceStep } from "./service-step";
import { readDraft, WithDraft } from "./wizard-test-utils";

const push = vi.fn();
const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

const client = { id: "c1", name: "Maria", phone: "(11) 99999-8888" };
const services = [
  { id: "s1", name: "Esmaltação", durationMinutes: 45, price: 50 },
  { id: "s2", name: "Alongamento", durationMinutes: 120, price: 120 },
];

function setup(list = services, patch: object = { client }) {
  const user = userEvent.setup();
  render(
    <WithDraft patch={patch}>
      <ServiceStep services={list} />
    </WithDraft>,
  );
  return { user, draft: () => readDraft(screen.getByTestId("draft")) };
}

const continuar = () => screen.getByRole("button", { name: /Continuar/ });

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  search = "";
});

describe("ServiceStep (etapa 2)", () => {
  it("sem cliente escolhida (ex.: página recarregada), leva de volta à etapa Cliente", async () => {
    setup(services, {});
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/agendamentos/novo/cliente"));
    expect(screen.queryByText("Esmaltação")).toBeNull();
  });

  it("lista os serviços com duração e preço", async () => {
    setup();
    expect(await screen.findByText("Esmaltação")).toBeInTheDocument();
    expect(screen.getByText("45 min • R$ 50,00")).toBeInTheDocument();
    expect(screen.getByText("2h • R$ 120,00")).toBeInTheDocument();
    expect(screen.getByText(/preenchidos automaticamente conforme o serviço/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sem serviço escolhido, 'Continuar' fica desativado e explica o que falta", async () => {
    setup();
    await screen.findByText("Esmaltação");
    expect(continuar()).toBeDisabled();
    expect(screen.getByText("Escolha um serviço para continuar.")).toBeInTheDocument();
  });

  it("tocar no serviço só ESCOLHE (preenche duração e preço); não avança sozinho", async () => {
    const { user, draft } = setup();
    await user.click(await screen.findByRole("button", { name: /Esmaltação/ }));

    expect(push).not.toHaveBeenCalled();
    expect(draft().service).toEqual({ id: "s1", name: "Esmaltação", durationMinutes: 45, price: 50 });
    expect(draft().durationMinutes).toBe("45");
    expect(draft().price).toBe("50,00");
    expect(continuar()).toBeEnabled();
  });

  it("'Continuar' leva a Data e horário", async () => {
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: /Esmaltação/ }));
    await user.click(continuar());
    expect(push).toHaveBeenCalledWith("/agendamentos/novo/horario");
  });

  it("trocar de serviço volta ao padrão do novo; escolher o mesmo mantém o que foi ajustado", async () => {
    const adjusted = { client, service: services[0], durationMinutes: "75", price: "65,50" };
    const { user, draft } = setup(services, adjusted);

    await user.click(await screen.findByRole("button", { name: /Esmaltação/ })); // o mesmo
    expect(draft().durationMinutes).toBe("75");
    expect(draft().price).toBe("65,50");

    await user.click(screen.getByRole("button", { name: /Alongamento/ })); // outro
    await waitFor(() => expect(draft().durationMinutes).toBe("120"));
    expect(draft().price).toBe("120,00");
  });

  it("o serviço escolhido aparece marcado, com 'Continuar' ativo", async () => {
    setup(services, { client, service: services[1] });
    const selected = await screen.findByRole("button", { name: /Alongamento/ });
    await waitFor(() => expect(selected).toHaveAttribute("aria-pressed", "true"));
    expect(selected).toHaveTextContent("Selecionado");
    expect(screen.getByRole("button", { name: /Esmaltação/ })).toHaveAttribute("aria-pressed", "false");
    expect(continuar()).toBeEnabled();
  });

  it("veio do resumo para trocar o serviço: 'Continuar' volta direto ao resumo", async () => {
    search = "retorno=detalhes";
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: /Alongamento/ }));
    await user.click(continuar());
    expect(push).toHaveBeenCalledWith("/agendamentos/novo/detalhes");
  });

  it("sem serviços ativos: orienta a cadastrar (e não mostra 'Continuar')", async () => {
    setup([]);
    expect(await screen.findByText("Você ainda não tem serviços ativos.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cadastrar serviço/ })).toHaveAttribute("href", "/servicos/novo");
    expect(screen.queryByRole("button", { name: /Continuar/ })).toBeNull();
  });

  it("a busca só aparece com 6 ou mais serviços", async () => {
    setup();
    await screen.findByText("Esmaltação");
    expect(screen.queryByLabelText("Buscar serviço")).toBeNull();
  });

  it("com muitos serviços, o campo de busca filtra a lista", async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, name: i === 3 ? "Spa dos pés" : `Serviço ${i}`, durationMinutes: 30, price: 10 }));
    const { user } = setup(many);
    await user.type(await screen.findByLabelText("Buscar serviço"), "spa");
    expect(screen.getByText("Spa dos pés")).toBeInTheDocument();
    expect(screen.queryByText("Serviço 1")).toBeNull();
    await user.clear(screen.getByLabelText("Buscar serviço"));
    await user.type(screen.getByLabelText("Buscar serviço"), "zzz");
    expect(screen.getByText("Nenhum serviço com esse nome.")).toBeInTheDocument();
  });
});
