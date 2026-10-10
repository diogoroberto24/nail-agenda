import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupForm } from "./signup-form";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
const signup = vi.fn();
vi.mock("./actions", () => ({ signup: (...a: unknown[]) => signup(...a) }));

async function fill(user: ReturnType<typeof userEvent.setup>, over: Record<string, string> = {}) {
  const v = { nome: "Maria Souza", email: "maria@exemplo.com", senha: "senha-1234", repetir: "senha-1234", convite: "convite-123", ...over };
  await user.type(screen.getByLabelText("Seu nome"), v.nome);
  await user.type(screen.getByLabelText("E-mail"), v.email);
  await user.type(screen.getByLabelText("Senha", { exact: true }), v.senha);
  await user.type(screen.getByLabelText("Repetir a senha"), v.repetir);
  await user.type(screen.getByLabelText("Código de convite"), v.convite);
}

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  signup.mockReset();
});

describe("SignupForm", () => {
  it("mostra os cinco campos e o botão", () => {
    render(<SignupForm />);
    for (const l of ["Seu nome", "E-mail", "Senha", "Repetir a senha", "Código de convite"]) {
      expect(screen.getByLabelText(l, { exact: true })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeInTheDocument();
  });

  it("campos vazios mostram os erros junto dos campos e não chamam o servidor", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("Informe seu nome.")).toBeInTheDocument();
    expect(screen.getByText("Informe seu e-mail.")).toBeInTheDocument();
    expect(screen.getByText("A senha precisa ter pelo menos 8 caracteres.")).toBeInTheDocument();
    expect(screen.getByText("Informe o código de convite.")).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();
  });

  it("senhas diferentes são apontadas", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    await fill(user, { repetir: "outra-senha" });
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("As senhas não são iguais.")).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();
  });

  it("cadastro certo entra no sistema (vai para o início)", async () => {
    signup.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(signup).toHaveBeenCalledWith(expect.objectContaining({ fullName: "Maria Souza", inviteCode: "convite-123" }));
  });

  it("erro do servidor aparece e os campos continuam preenchidos", async () => {
    signup.mockResolvedValue({ ok: false, error: "Código de convite inválido." });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Código de convite inválido.");
    expect(screen.getByLabelText("Seu nome")).toHaveValue("Maria Souza");
    expect(screen.getByLabelText("Código de convite")).toHaveValue("convite-123");
    expect(replace).not.toHaveBeenCalled();
  });

  it("mostrar a senha revela os dois campos de senha", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(screen.getByLabelText("Senha", { exact: true })).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Repetir a senha")).toHaveAttribute("type", "text");
  });
});
