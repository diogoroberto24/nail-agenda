import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl } from "./whatsapp";
import { formatBrazilPhone, normalizeBrazilPhone } from "./phone";

describe("normalizeBrazilPhone", () => {
  it.each([
    ["(11) 99999-8888", "5511999998888"],
    ["11999998888", "5511999998888"],
    ["+55 11 99999-8888", "5511999998888"],
    ["5511999998888", "5511999998888"],
    ["011 99999-8888", "5511999998888"],
    ["(21) 2345-6789", "552123456789"],
  ])("aceita %s", (input, expected) => {
    expect(normalizeBrazilPhone(input)).toBe(expected);
  });

  it.each([
    "",
    "abc",
    "123",
    "(11) 9999-888", // curto demais
    "(11) 89999-8888", // celular de 9 dígitos precisa começar com 9
    "(10) 99999-8888", // DDD inexistente
    "(11) 19999-888", // fixo de 8 dígitos não começa com 1
    "55 11 99999-88889", // longo demais
  ])("recusa %j", (input) => {
    expect(normalizeBrazilPhone(input)).toBeNull();
  });

  it("o resultado sempre cabe na restrição do banco (12 ou 13 dígitos)", () => {
    for (const raw of ["(11) 99999-8888", "(21) 2345-6789"]) {
      expect(normalizeBrazilPhone(raw)).toMatch(/^[0-9]{12,13}$/);
    }
  });
});

describe("formatBrazilPhone", () => {
  it("formata celular e fixo", () => {
    expect(formatBrazilPhone("5511999998888")).toBe("(11) 99999-8888");
    expect(formatBrazilPhone("552123456789")).toBe("(21) 2345-6789");
  });
  it("devolve o texto original se não reconhecer", () => {
    expect(formatBrazilPhone("123")).toBe("123");
  });
});

describe("buildWhatsAppUrl", () => {
  it("monta o link wa.me sem mensagem", () => {
    expect(buildWhatsAppUrl("5511999998888")).toBe("https://wa.me/5511999998888");
  });
  it("codifica a mensagem (acentos, espaços, quebra de linha, & e ?)", () => {
    const url = buildWhatsAppUrl("5511999998888", "Olá, Maria! Tudo bem?\nDia 10 & 11");
    expect(url).toBe(
      "https://wa.me/5511999998888?text=" + encodeURIComponent("Olá, Maria! Tudo bem?\nDia 10 & 11"),
    );
    expect(url).not.toContain(" ");
    expect(url).not.toContain("\n");
  });
  it("retorna null para telefone inválido", () => {
    expect(buildWhatsAppUrl("123")).toBeNull();
    expect(buildWhatsAppUrl("")).toBeNull();
    expect(buildWhatsAppUrl("5511999")).toBeNull();
  });
});
