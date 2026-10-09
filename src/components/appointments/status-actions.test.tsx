import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusActions } from "./status-actions";
import type { AppointmentStatus } from "@/lib/appointments/status";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh }) }));
vi.mock("@/app/(app)/agendamentos/actions", () => ({ setAppointmentStatusAction: vi.fn() }));

type Props = React.ComponentProps<typeof StatusActions>;

function setup(status: AppointmentStatus, variant: Props["variant"], setStatus = vi.fn().mockResolvedValue({ ok: true, status: "confirmed" })) {
  const user = userEvent.setup();
  render(
    <StatusActions
      appointmentId="a-1"
      status={status}
      clientName="Maria Silva"
      variant={variant}
      afterCancelHref="/agenda?data=2031-03-10&cancelado=1"
      setStatus={setStatus as unknown as Props["setStatus"]}
    />,
  );
  return { user, setStatus };
}

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
});

describe("StatusActions", () => {
  it("cancelado é definitivo e não mostra nenhuma ação", () => {
    const { container } = render(
      <StatusActions appointmentId="a" status="cancelled" clientName="X" variant="card" afterCancelHref="/agenda" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("concluído e não compareceu mostram só Reabrir atendimento (sem Confirmar, Concluir ou Cancelar)", () => {
    for (const status of ["completed", "no_show"] as const) {
      for (const variant of ["card", "detail"] as const) {
        const { unmount } = render(
          <StatusActions appointmentId="a" status={status} clientName="X" variant={variant} afterCancelHref="/agenda" />,
        );
        expect(screen.getByRole("button", { name: "Reabrir atendimento" })).toBeInTheDocument();
        expect(screen.getAllByRole("button")).toHaveLength(1);
        unmount();
      }
    }
  });

  it("reabrir um concluído por engano volta para confirmado e recarrega a tela", async () => {
    const { user, setStatus } = setup("completed", "card");
    await user.click(screen.getByRole("button", { name: "Reabrir atendimento" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(setStatus).toHaveBeenCalledWith("a-1", "confirmed", "completed");
    expect(push).not.toHaveBeenCalled();
  });

  it("reabrir: erro do servidor aparece e a tela recarrega o estado real", async () => {
    const setStatus = vi.fn().mockResolvedValue({ ok: false, error: "Este atendimento já foi alterado em outro aparelho. A tela foi atualizada." });
    const { user } = setup("no_show", "detail", setStatus);
    await user.click(screen.getByRole("button", { name: "Reabrir atendimento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("outro aparelho");
    expect(refresh).toHaveBeenCalled();
  });

  it("card aguardando confirmação: ação principal é Confirmar, e o menu Mais traz as demais", async () => {
    const { user } = setup("awaiting_confirmation", "card");
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar agendamento" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Mais ações para Maria Silva/ }));
    expect(screen.getByRole("button", { name: "Concluir atendimento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Não compareceu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar agendamento" })).toBeInTheDocument();
  });

  it("card confirmado: ação principal é Concluir e não oferece Confirmar de novo", async () => {
    const { user } = setup("confirmed", "card");
    expect(screen.getByRole("button", { name: "Concluir" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Mais ações/ }));
    expect(screen.queryByRole("button", { name: "Confirmar atendimento" })).toBeNull();
    expect(screen.getByRole("button", { name: "Não compareceu" })).toBeInTheDocument();
  });

  it("confirmar chama a ação com o status esperado e recarrega a tela", async () => {
    const { user, setStatus } = setup("awaiting_confirmation", "card");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(setStatus).toHaveBeenCalledWith("a-1", "confirmed", "awaiting_confirmation");
    expect(push).not.toHaveBeenCalled();
  });

  it("cancelar exige confirmação: 'Voltar' não cancela; confirmar cancela e vai para a agenda com aviso", async () => {
    const { user, setStatus } = setup("confirmed", "card");
    await user.click(screen.getByRole("button", { name: /Mais ações/ }));
    await user.click(screen.getByRole("button", { name: "Cancelar agendamento" }));

    expect(screen.getByRole("alertdialog")).toHaveTextContent("Maria Silva");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("horário será liberado");
    expect(setStatus).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(setStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();

    // o menu continua aberto depois de Voltar
    await user.click(screen.getByRole("button", { name: "Cancelar agendamento" }));
    await user.click(screen.getByRole("button", { name: "Cancelar atendimento" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/agenda?data=2031-03-10&cancelado=1"));
    expect(setStatus).toHaveBeenCalledWith("a-1", "cancelled", "confirmed");
  });

  it("não compareceu e concluir atuam direto (sem confirmação extra)", async () => {
    const { user, setStatus } = setup("awaiting_confirmation", "card");
    await user.click(screen.getByRole("button", { name: /Mais ações/ }));
    await user.click(screen.getByRole("button", { name: "Não compareceu" }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("a-1", "no_show", "awaiting_confirmation"));
  });

  it("detalhe mostra todas as ações de uma vez", () => {
    setup("awaiting_confirmation", "detail");
    for (const name of ["Confirmar atendimento", "Concluir atendimento", "Não compareceu", "Cancelar agendamento"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("erro do servidor (ex.: alterado em outro aparelho): mostra a mensagem e recarrega o estado real", async () => {
    const setStatus = vi.fn().mockResolvedValue({ ok: false, error: "Este atendimento já foi alterado em outro aparelho. A tela foi atualizada." });
    const { user } = setup("awaiting_confirmation", "card", setStatus);
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("alterado em outro aparelho");
    expect(refresh).toHaveBeenCalled();
  });

  it("falha de conexão: mensagem clara, sem recarregar nem navegar", async () => {
    const setStatus = vi.fn().mockRejectedValue(new Error("offline"));
    const { user } = setup("awaiting_confirmation", "card", setStatus);
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Verifique a conexão");
    expect(push).not.toHaveBeenCalled();
  });

  it("desabilita os botões durante a operação (sem toque duplicado)", async () => {
    let finish: (v: unknown) => void = () => {};
    const setStatus = vi.fn().mockReturnValue(new Promise((r) => (finish = r)));
    const { user } = setup("awaiting_confirmation", "card", setStatus);
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    const confirmBtn = screen.getAllByRole("button")[0];
    expect(confirmBtn).toBeDisabled();
    await user.click(confirmBtn);
    expect(setStatus).toHaveBeenCalledTimes(1);
    finish({ ok: true, status: "confirmed" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
