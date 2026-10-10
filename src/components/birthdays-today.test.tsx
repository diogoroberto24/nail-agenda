import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BirthdaysToday } from "./birthdays-today";
import { buildBirthdayMessage } from "@/lib/whatsapp-message";

const maria = { id: "1", full_name: "Maria Aparecida Silva", phone: "5511999998888", birth_year: 1990 };
const ana = { id: "2", full_name: "Ana Paula", phone: "5511988887777", birth_year: null };

describe("mensagem de aniversário", () => {
  it("usa só o primeiro nome e assina com o nome da profissional", () => {
    const m = buildBirthdayMessage({ clientName: "Maria Aparecida Silva", professionalName: "Camila" });
    expect(m.startsWith("Olá Maria! 🎂💖")).toBe(true);
    expect(m).toContain("feliz aniversário");
    expect(m.endsWith("Camila ✨")).toBe(true);
    expect(m).not.toContain("Aparecida");
  });

  it("nome vazio não deixa a mensagem quebrada", () => {
    expect(buildBirthdayMessage({ clientName: "  ", professionalName: "Camila" })).toContain("Olá cliente!");
  });
});

describe("Aniversariantes de hoje", () => {
  it("não mostra nada quando ninguém faz aniversário", () => {
    const { container } = render(<BirthdaysToday people={[]} today="2026-03-15" professionalName="Camila" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lista cada aniversariante com telefone, idade (se o ano foi informado) e o botão do WhatsApp com a mensagem pronta", () => {
    render(<BirthdaysToday people={[maria, ana]} today="2026-03-15" professionalName="Camila" />);
    expect(screen.getByRole("heading", { name: "Aniversariantes de hoje" })).toBeInTheDocument();
    expect(screen.getByText(/\(11\) 99999-8888 · faz 36 anos/)).toBeInTheDocument();
    expect(screen.getByText("(11) 98888-7777")).toBeInTheDocument(); // sem ano: sem idade

    const links = screen.getAllByRole("link", { name: "Enviar parabéns" });
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toMatch(/^https:\/\/wa\.me\/5511999998888\?text=/);
    expect(decodeURIComponent(links[0].getAttribute("href")!)).toContain("Olá Maria! 🎂💖");
    expect(decodeURIComponent(links[0].getAttribute("href")!)).toContain("Camila");
    expect(links[0]).toHaveAttribute("target", "_blank");
  });
});
