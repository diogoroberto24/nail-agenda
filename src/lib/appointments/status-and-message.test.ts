import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { buildConfirmationMessage, firstName } from "@/lib/whatsapp-message";
import { greetingForHour } from "@/lib/greeting";
import { APPOINTMENT_STATUSES } from "./status";
import { allowedTransitions, canTransition, isFinalStatus, isOpenStatus, isReopen } from "./transitions";

describe("mensagem de confirmação do WhatsApp", () => {
  const input = {
    clientName: "Maria Aparecida Silva",
    startAt: "2026-11-10T13:00:00Z", // 10:00 em São Paulo
    serviceName: "Alongamento em gel",
    professionalName: "Ana",
  };

  it("segue exatamente o modelo definido, com o primeiro nome da cliente", () => {
    expect(buildConfirmationMessage(input)).toBe(
      [
        "Olá Maria, tudo bem? 🤍",
        "",
        "Passando para confirmar seu agendamento!",
        "",
        "📅 Data: 10/11",
        "⏰ Horário: 10:00",
        "💅 Procedimento: Alongamento em gel",
        "Manicure: Ana",
        "",
        "Está tudo certinho para você?",
        "",
        "Caso precise cancelar ou remarcar, pedimos que nos avise com antecedência.",
        "",
        "Aguardamos você! Será um prazer te atender.",
      ].join("\n"),
    );
  });

  it("usa a data e a hora do fuso do salão, não as do aparelho (23:30 em SP ainda é o mesmo dia)", () => {
    const msg = buildConfirmationMessage({ ...input, startAt: "2026-11-11T02:30:00Z" });
    expect(msg).toContain("📅 Data: 10/11");
    expect(msg).toContain("⏰ Horário: 23:30");
  });

  it("primeiro nome: ignora espaços extras e não quebra com nome vazio", () => {
    expect(firstName("  Ana   Paula ")).toBe("Ana");
    expect(firstName("Beatriz")).toBe("Beatriz");
    expect(firstName("   ")).toBe("cliente");
    expect(buildConfirmationMessage({ ...input, clientName: "" })).toContain("Olá cliente, tudo bem?");
  });

  it("vai codificada no link: emojis, acentos e quebras de linha chegam inteiros", () => {
    const message = buildConfirmationMessage(input);
    const url = buildWhatsAppUrl("5511999998888", message)!;
    expect(url.startsWith("https://wa.me/5511999998888?text=")).toBe(true);
    expect(url).not.toMatch(/[\s\n]/);
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(message);
  });
});

describe("transições de status", () => {
  it("aguardando confirmação pode ser confirmado, concluído, ter falta ou ser cancelado", () => {
    expect([...allowedTransitions("awaiting_confirmation")].sort()).toEqual(["cancelled", "completed", "confirmed", "no_show"]);
  });

  it("confirmado pode ser concluído, ter falta ou ser cancelado, mas não voltar a aguardar por ação direta", () => {
    expect(canTransition("confirmed", "completed")).toBe(true);
    expect(canTransition("confirmed", "no_show")).toBe(true);
    expect(canTransition("confirmed", "cancelled")).toBe(true);
    expect(canTransition("confirmed", "awaiting_confirmation")).toBe(false);
  });

  it("concluído e não compareceu podem ser REABERTOS (voltam para confirmado) e nada mais", () => {
    for (const s of ["completed", "no_show"] as const) {
      expect([...allowedTransitions(s)]).toEqual(["confirmed"]);
      expect(isReopen(s, "confirmed")).toBe(true);
      for (const to of ["awaiting_confirmation", "completed", "no_show", "cancelled"] as const) {
        expect(canTransition(s, to)).toBe(false);
      }
      expect(isFinalStatus(s)).toBe(false);
    }
  });

  it("cancelado é definitivo", () => {
    expect(isFinalStatus("cancelled")).toBe(true);
    for (const to of APPOINTMENT_STATUSES) expect(canTransition("cancelled", to)).toBe(false);
    expect(isReopen("cancelled", "confirmed")).toBe(false);
    expect(isFinalStatus("awaiting_confirmation")).toBe(false);
    expect(isFinalStatus("confirmed")).toBe(false);
  });

  it("só aguardando e confirmado são abertos (editáveis e com mensagem de confirmação)", () => {
    expect(isOpenStatus("awaiting_confirmation")).toBe(true);
    expect(isOpenStatus("confirmed")).toBe(true);
    for (const s of ["completed", "no_show", "cancelled"] as const) expect(isOpenStatus(s)).toBe(false);
    expect(isReopen("confirmed", "completed")).toBe(false);
  });

  it("nenhum status transita para si mesmo", () => {
    for (const s of APPOINTMENT_STATUSES) expect(canTransition(s, s)).toBe(false);
  });
});

describe("saudação", () => {
  it.each([
    [0, "Boa noite"],
    [4, "Boa noite"],
    [5, "Bom dia"],
    [11, "Bom dia"],
    [12, "Boa tarde"],
    [17, "Boa tarde"],
    [18, "Boa noite"],
    [23, "Boa noite"],
  ])("%ih → %s", (hour, expected) => {
    expect(greetingForHour(hour)).toBe(expected);
  });
});
