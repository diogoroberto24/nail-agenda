import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetailsStep } from "./details-step";
import { SuccessScreen } from "./success-screen";
import { DraftProvider } from "./draft-context";
import { readDraft, DraftProbe } from "./wizard-test-utils";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(""),
}));

const createAppointmentAction = vi.fn();
vi.mock("@/app/(app)/agendamentos/actions", () => ({
  createAppointmentAction: (...args: unknown[]) => createAppointmentAction(...args),
}));

const client = { id: "11111111-1111-4111-8111-111111111111", name: "Maria Silva", phone: "(11) 99999-8888" };
const service = { id: "22222222-2222-4222-8222-222222222222", name: "Esmaltação", durationMinutes: 45, price: 50 };
const full = { client, service, date: "2031-12-01", time: "10:00", durationMinutes: "45", price: "50,00", notes: "" };

function setup(patch: object = full, withSuccess = false) {
  const user = userEvent.setup();
  render(
    <DraftProvider initial={patch} professionalName="Profissional 1">
      <DetailsStep />
      {withSuccess && <SuccessScreen />}
      <DraftProbe />
    </DraftProvider>,
  );
  return { user, draft: () => readDraft(screen.getByTestId("draft")) };
}

const agendar = () => screen.getByRole("button", { name: "Agendar" });

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  createAppointmentAction.mockReset();
});

describe("DetailsStep (etapa 4)", () => {
  it("o resumo mostra cliente, serviço, data e horário (com o término) e a profissional", () => {
    setup();
    const resumo = screen.getByRole("region", { name: "Resumo" });
    expect(resumo).toHaveTextContent("Maria Silva");
    expect(resumo).toHaveTextContent("Esmaltação");
    expect(resumo).toHaveTextContent("10:00 – 10:45");
    expect(resumo).toHaveTextContent("Profissional 1");
  });

  it("as linhas do resumo levam às etapas com ?retorno=detalhes; a Profissional não é link", () => {
    setup();
    const resumo = screen.getByRole("region", { name: "Resumo" });
    const links = within(resumo).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/agendamentos/novo/cliente?retorno=detalhes",
      "/agendamentos/novo/servico?retorno=detalhes",
      "/agendamentos/novo/horario?retorno=detalhes",
    ]);
  });

  it("sem horário no rascunho (página recarregada), volta à etapa que falta", async () => {
    setup({ client, service });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/agendamentos/novo/horario"));
  });

  it("duração inválida mostra o erro e não salva", async () => {
    const { user } = setup();
    const duracao = screen.getByLabelText(/Duração \(min\)/);
    await user.clear(duracao);
    await user.type(duracao, "abc");
    await user.click(agendar());
    expect(await screen.findByText("Use só números, ex.: 40.")).toBeInTheDocument();
    expect(createAppointmentAction).not.toHaveBeenCalled();
  });

  it("observações têm limite de 200 caracteres e contador", async () => {
    const { user } = setup();
    const obs = screen.getByLabelText(/Observações/);
    await user.click(obs);
    await user.paste("x".repeat(250));
    expect(obs).toHaveValue("x".repeat(200));
    expect(screen.getByText("200/200")).toBeInTheDocument();
  });

  it("agenda com os valores ajustados, guarda o resultado e vai para a tela de sucesso", async () => {
    createAppointmentAction.mockResolvedValue({ ok: true, id: "a1", date: "2031-12-01" });
    const { user, draft } = setup();
    const duracao = screen.getByLabelText(/Duração \(min\)/);
    await user.clear(duracao);
    await user.type(duracao, "75");
    await user.click(agendar());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/agendamentos/novo/sucesso"));
    expect(createAppointmentAction).toHaveBeenCalledWith(
      draft().attemptId,
      expect.objectContaining({ clientId: client.id, serviceId: service.id, date: "2031-12-01", time: "10:00", durationMinutes: "75", price: "50,00" }),
      false,
    );
  });

  it("a tela de sucesso mostra o resumo e os próximos passos, com a mensagem do WhatsApp", async () => {
    createAppointmentAction.mockResolvedValue({ ok: true, id: "a1", date: "2031-12-01" });
    const { user } = setup(full, true);
    await user.click(agendar());
    expect(await screen.findByRole("heading", { name: "Agendamento realizado!" })).toBeInTheDocument();
    const resumo = screen.getByRole("region", { name: "Resumo do agendamento" });
    expect(resumo).toHaveTextContent("Maria Silva");
    expect(resumo).toHaveTextContent("10:00 – 10:45");
    expect(resumo).toHaveTextContent("R$ 50,00");
    const wa = screen.getByRole("link", { name: "Enviar confirmação no WhatsApp" });
    expect(wa.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/5511999998888\?text=/);
    expect(decodeURIComponent(wa.getAttribute("href")!)).toContain("Olá Maria");
    expect(screen.getByRole("link", { name: "Ver na agenda" })).toHaveAttribute("href", "/agenda?data=2031-12-01&destaque=a1");
    expect(screen.getByRole("link", { name: "Novo agendamento" })).toHaveAttribute("href", "/agendamentos/novo");
  });

  it("horário ocupado abre o aviso, sem salvar; 'Voltar' fecha", async () => {
    createAppointmentAction.mockResolvedValue({ ok: false, code: "conflict", conflicts: [{ id: "x", clientName: "Ana", start: "10:00", end: "10:45" }] });
    const { user } = setup();
    await user.click(agendar());
    const dialog = await screen.findByRole("dialog", { name: "Horário ocupado" });
    expect(dialog).toHaveTextContent("10:00 às 10:45, Ana");
    expect(push).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Voltar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("'Escolher outro horário' leva à etapa de horário (voltando ao resumo depois)", async () => {
    createAppointmentAction.mockResolvedValue({ ok: false, code: "conflict", conflicts: [{ id: "x", clientName: "Ana", start: "10:00", end: "10:45" }] });
    const { user } = setup();
    await user.click(agendar());
    await user.click(await screen.findByRole("button", { name: "Escolher outro horário" }));
    expect(push).toHaveBeenCalledWith("/agendamentos/novo/horario?retorno=detalhes");
  });

  it("'Agendar mesmo assim' reenvia a MESMA tentativa confirmando o conflito", async () => {
    createAppointmentAction
      .mockResolvedValueOnce({ ok: false, code: "conflict", conflicts: [{ id: "x", clientName: "Ana", start: "10:00", end: "10:45" }] })
      .mockResolvedValueOnce({ ok: true, id: "a1", date: "2031-12-01" });
    const { user } = setup();
    await user.click(agendar());
    await user.click(await screen.findByRole("button", { name: "Agendar mesmo assim" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/agendamentos/novo/sucesso"));
    const [first, second] = createAppointmentAction.mock.calls;
    expect(second[0]).toBe(first[0]); // mesmo identificador: não duplica
    expect(first[2]).toBe(false);
    expect(second[2]).toBe(true);
  });

  it("erro do servidor é mostrado e os campos continuam preenchidos", async () => {
    createAppointmentAction.mockResolvedValue({ ok: false, code: "error", error: "Serviço não encontrado." });
    const { user } = setup();
    await user.click(agendar());
    expect(await screen.findByRole("alert")).toHaveTextContent("Serviço não encontrado.");
    expect(screen.getByLabelText(/Duração \(min\)/)).toHaveValue("45");
    expect(push).not.toHaveBeenCalled();
  });

  it("falha de conexão mostra aviso e permite tentar de novo", async () => {
    createAppointmentAction.mockRejectedValueOnce(new Error("rede"));
    const { user } = setup();
    await user.click(agendar());
    expect(await screen.findByRole("alert")).toHaveTextContent(/Verifique a conexão/);
  });
});

describe("SuccessScreen sem atendimento salvo", () => {
  it("volta para a agenda", async () => {
    render(
      <DraftProvider professionalName="Profissional 1">
        <SuccessScreen />
      </DraftProvider>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/agenda"));
  });
});
