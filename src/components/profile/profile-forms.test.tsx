import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DisplayNameForm, EmailForm, PasswordForm } from "./profile-forms";
import { emailChangeSchema, passwordChangeSchema } from "@/lib/profile/schema";

vi.mock("@/app/(app)/perfil/actions", () => ({
  updateDisplayNameAction: vi.fn(),
  changePasswordAction: vi.fn(),
  requestEmailChangeAction: vi.fn(),
}));

type Props = React.ComponentProps<typeof PasswordForm>;
type Actions = NonNullable<Props["actions"]>;

function makeActions(over: Partial<Record<keyof Actions, unknown>> = {}) {
  return {
    updateName: vi.fn().mockResolvedValue({ ok: true, message: "Nome atualizado." }),
    changePassword: vi.fn().mockResolvedValue({ ok: true, message: "Senha alterada." }),
    requestEmail: vi.fn().mockResolvedValue({ ok: true, message: "Enviamos um link de confirmação para nova@exemplo.com." }),
    ...over,
  } as unknown as Actions;
}

describe("schemas do perfil", () => {
  const ok = { currentPassword: "senhaAtual1", newPassword: "novaSenha99", confirmPassword: "novaSenha99" };

  it("aceita uma troca de senha válida", () => {
    expect(passwordChangeSchema.safeParse(ok).success).toBe(true);
  });

  it.each([
    [{ newPassword: "curta", confirmPassword: "curta" }, "pelo menos 8"],
    [{ confirmPassword: "diferente99" }, "não são iguais"],
    [{ newPassword: "senhaAtual1", confirmPassword: "senhaAtual1" }, "diferente da atual"],
    [{ currentPassword: "" }, "senha atual"],
    [{ newPassword: "x".repeat(73), confirmPassword: "x".repeat(73) }, "no máximo 72"],
  ])("recusa %j", (over, texto) => {
    const r = passwordChangeSchema.safeParse({ ...ok, ...over });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message).join(" ")).toContain(texto);
  });

  it("e-mail: exige formato válido e a senha atual", () => {
    expect(emailChangeSchema.safeParse({ newEmail: "a@b.com", currentPassword: "x" }).success).toBe(true);
    expect(emailChangeSchema.safeParse({ newEmail: "a@", currentPassword: "x" }).success).toBe(false);
    expect(emailChangeSchema.safeParse({ newEmail: "a@b.com", currentPassword: "" }).success).toBe(false);
  });
});

describe("DisplayNameForm", () => {
  it("carrega o nome atual, valida e salva", async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<DisplayNameForm initialName="Ana" actions={actions} />);
    expect(screen.getByLabelText("Nome de exibição")).toHaveValue("Ana");

    await user.clear(screen.getByLabelText("Nome de exibição"));
    await user.type(screen.getByLabelText("Nome de exibição"), "A");
    await user.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(await screen.findByText("Informe seu nome.")).toBeInTheDocument();
    expect(actions.updateName).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Nome de exibição"));
    await user.type(screen.getByLabelText("Nome de exibição"), "Ana Paula");
    await user.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Nome atualizado.");
    expect(actions.updateName).toHaveBeenCalledWith({ displayName: "Ana Paula" });
  });
});

describe("PasswordForm", () => {
  async function fill(user: ReturnType<typeof userEvent.setup>, current: string, next: string, confirm: string) {
    await user.type(screen.getByLabelText("Senha atual"), current);
    await user.type(screen.getByLabelText("Nova senha"), next);
    await user.type(screen.getByLabelText("Repita a nova senha"), confirm);
  }

  it("mostra os erros junto dos campos e não envia dados inválidos", async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<PasswordForm actions={actions} />);
    await fill(user, "senhaAtual1", "curta", "outra");
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    expect(await screen.findByText(/pelo menos 8 caracteres\./, { selector: "p" })).toBeInTheDocument();
    expect(actions.changePassword).not.toHaveBeenCalled();
  });

  it("senhas diferentes: mostra o erro no campo de confirmação", async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<PasswordForm actions={actions} />);
    await fill(user, "senhaAtual1", "novaSenha99", "novaSenha98");
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    expect(await screen.findByText("As senhas não são iguais.")).toBeInTheDocument();
    expect(actions.changePassword).not.toHaveBeenCalled();
  });

  it("sucesso: confirma e limpa os campos de senha", async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<PasswordForm actions={actions} />);
    await fill(user, "senhaAtual1", "novaSenha99", "novaSenha99");
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Senha alterada.");
    expect(actions.changePassword).toHaveBeenCalledWith({ currentPassword: "senhaAtual1", newPassword: "novaSenha99", confirmPassword: "novaSenha99" });
    expect(screen.getByLabelText("Senha atual")).toHaveValue("");
    expect(screen.getByLabelText("Nova senha")).toHaveValue("");
  });

  it("senha atual errada: erro no campo certo, sem limpar o que foi digitado", async () => {
    const changePassword = vi.fn().mockResolvedValue({ ok: false, error: "Senha atual incorreta.", field: "currentPassword" });
    const user = userEvent.setup();
    render(<PasswordForm actions={makeActions({ changePassword })} />);
    await fill(user, "errada123", "novaSenha99", "novaSenha99");
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    expect(await screen.findByText("Senha atual incorreta.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nova senha")).toHaveValue("novaSenha99");
  });

  it("falha de conexão: mensagem clara e campos preservados", async () => {
    const changePassword = vi.fn().mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<PasswordForm actions={makeActions({ changePassword })} />);
    await fill(user, "senhaAtual1", "novaSenha99", "novaSenha99");
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Verifique a conexão");
    expect(screen.getByLabelText("Senha atual")).toHaveValue("senhaAtual1");
  });

  it("mostrar e ocultar a senha", async () => {
    const user = userEvent.setup();
    render(<PasswordForm actions={makeActions()} />);
    const field = screen.getByLabelText("Nova senha");
    expect(field).toHaveAttribute("type", "password");
    await user.click(screen.getAllByRole("button", { name: "Mostrar senha" })[1]);
    expect(field).toHaveAttribute("type", "text");
  });

  it("desabilita o botão durante o envio", async () => {
    let finish: (v: unknown) => void = () => {};
    const changePassword = vi.fn().mockReturnValue(new Promise((r) => (finish = r)));
    const user = userEvent.setup();
    render(<PasswordForm actions={makeActions({ changePassword })} />);
    await fill(user, "senhaAtual1", "novaSenha99", "novaSenha99");
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    const busy = await screen.findByRole("button", { name: /Alterando/ });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(changePassword).toHaveBeenCalledTimes(1);
    finish({ ok: true });
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
  });
});

describe("EmailForm", () => {
  it("mostra o e-mail atual e explica que é preciso confirmar o novo", async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(<EmailForm currentEmail="ana@exemplo.com" actions={actions} />);
    expect(screen.getByText("ana@exemplo.com")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Novo e-mail"), "nova@exemplo.com");
    await user.type(screen.getByLabelText("Senha atual"), "senhaAtual1");
    await user.click(screen.getByRole("button", { name: "Trocar e-mail" }));
    expect(await screen.findByRole("status")).toHaveTextContent("link de confirmação");
    expect(actions.requestEmail).toHaveBeenCalledWith({ newEmail: "nova@exemplo.com", currentPassword: "senhaAtual1" });
  });

  it("e-mail inválido não é enviado; senha errada mostra o erro no campo da senha", async () => {
    const requestEmail = vi.fn().mockResolvedValue({ ok: false, error: "Senha atual incorreta.", field: "currentPassword" });
    const user = userEvent.setup();
    render(<EmailForm currentEmail="ana@exemplo.com" actions={makeActions({ requestEmail })} />);

    await user.type(screen.getByLabelText("Novo e-mail"), "isso-nao-e-email");
    await user.type(screen.getByLabelText("Senha atual"), "x");
    await user.click(screen.getByRole("button", { name: "Trocar e-mail" }));
    expect(await screen.findByText("E-mail inválido.")).toBeInTheDocument();
    expect(requestEmail).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Novo e-mail"));
    await user.type(screen.getByLabelText("Novo e-mail"), "nova@exemplo.com");
    await user.click(screen.getByRole("button", { name: "Trocar e-mail" }));
    expect(await screen.findByText("Senha atual incorreta.")).toBeInTheDocument();
  });
});
