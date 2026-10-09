import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./status-badge";
import { WhatsAppLink } from "./whatsapp-link";
import { APPOINTMENT_STATUSES, STATUS_LABEL } from "@/lib/appointments/status";

describe("StatusBadge", () => {
  it("mostra o texto de cada um dos 5 status (não depende só da cor)", () => {
    expect(APPOINTMENT_STATUSES).toHaveLength(5);
    for (const status of APPOINTMENT_STATUSES) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(STATUS_LABEL[status])).toBeInTheDocument();
      unmount();
    }
  });
});

describe("WhatsAppLink", () => {
  it("abre o wa.me da cliente em nova aba, com nome acessível", () => {
    render(<WhatsAppLink phone="5511999998888" name="Maria" />);
    const link = screen.getByRole("link", { name: "Abrir WhatsApp de Maria" });
    expect(link).toHaveAttribute("href", "https://wa.me/5511999998888");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("variante botão com texto", () => {
    render(<WhatsAppLink phone="5511999998888" name="Maria" variant="button" />);
    expect(screen.getByRole("link", { name: /Abrir WhatsApp/ })).toBeInTheDocument();
  });

  it("telefone inválido: não gera link e avisa", () => {
    render(<WhatsAppLink phone="123" name="Maria" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Tel. inválido")).toBeInTheDocument();
  });
});
