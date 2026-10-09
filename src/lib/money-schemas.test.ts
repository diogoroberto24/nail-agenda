import { describe, expect, it } from "vitest";
import { formatBRL, formatPriceInput, parsePrice } from "./money";
import { formatDuration } from "./datetime";
import { clientSchema, toClientRow } from "./clients/schema";
import { serviceSchema, toServiceRow } from "./services/schema";

describe("parsePrice", () => {
  it.each([
    ["50", 50],
    ["50,5", 50.5],
    ["50,00", 50],
    ["1.234,56", 1234.56],
    ["R$ 80,00", 80],
    ["0", 0],
  ])("lê %s", (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });

  it.each(["", "abc", "-5", "50,555", "1,234.56", "12..3", "5 0 0,0x"])("recusa %j", (input) => {
    expect(parsePrice(input)).toBeNull();
  });
});

describe("formatação", () => {
  it("formata reais e o campo de edição", () => {
    expect(formatBRL(50).replace(/\s/g, " ")).toBe("R$ 50,00");
    expect(formatBRL("1234.5").replace(/\s/g, " ")).toBe("R$ 1.234,50");
    expect(formatPriceInput("50.00")).toBe("50,00");
  });
  it("formata duração", () => {
    expect(formatDuration(40)).toBe("40 min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h30");
    expect(formatDuration(125)).toBe("2h05");
  });
});

describe("clientSchema", () => {
  it("aceita dados válidos e normaliza para o banco", () => {
    const parsed = clientSchema.parse({ fullName: "  Maria Silva ", phone: "(11) 99999-8888", notes: "" });
    expect(toClientRow(parsed)).toEqual({ full_name: "Maria Silva", phone: "5511999998888", notes: null });
  });
  it("guarda observações quando informadas", () => {
    const parsed = clientSchema.parse({ fullName: "Ana", phone: "11999998888", notes: " alérgica a acetona " });
    expect(toClientRow(parsed).notes).toBe("alérgica a acetona");
  });
  it("mostra mensagens em português", () => {
    const r = clientSchema.safeParse({ fullName: "A", phone: "123" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      expect(msgs).toContain("Informe o nome completo.");
      expect(msgs.some((m) => m.startsWith("Telefone inválido"))).toBe(true);
    }
  });
  it("recusa observações muito longas", () => {
    expect(clientSchema.safeParse({ fullName: "Ana", phone: "11999998888", notes: "x".repeat(501) }).success).toBe(false);
  });
});

describe("serviceSchema", () => {
  const ok = { name: "Esmaltação", description: "", durationMinutes: "40", price: "50,00" };

  it("aceita dados válidos e converte para o banco", () => {
    expect(toServiceRow(serviceSchema.parse(ok))).toEqual({
      name: "Esmaltação",
      description: null,
      default_duration_minutes: 40,
      default_price: 50,
    });
  });
  it("recusa duração fora do intervalo ou não numérica", () => {
    for (const d of ["0", "4", "721", "abc", "4,5", "-10", ""]) {
      expect(serviceSchema.safeParse({ ...ok, durationMinutes: d }).success).toBe(false);
    }
    for (const d of ["5", "720"]) {
      expect(serviceSchema.safeParse({ ...ok, durationMinutes: d }).success).toBe(true);
    }
  });
  it("recusa preço inválido, negativo ou acima do limite", () => {
    for (const p of ["", "abc", "-1", "100000"]) {
      expect(serviceSchema.safeParse({ ...ok, price: p }).success).toBe(false);
    }
    expect(serviceSchema.safeParse({ ...ok, price: "0" }).success).toBe(true);
  });
});
