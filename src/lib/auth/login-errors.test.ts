import { describe, expect, it } from "vitest";
import { classifyAuthError, loginErrorMessage, LOGIN_MESSAGES } from "./login-errors";

describe("erros de login", () => {
  it("só invalid_credentials (400) é senha ou e-mail errados", () => {
    expect(classifyAuthError({ status: 400, code: "invalid_credentials" })).toBe("credentials");
    expect(loginErrorMessage({ status: 400, code: "invalid_credentials" }).message).toBe("E-mail ou senha incorretos.");
  });

  it("chave inválida (401 'Invalid API key', sem código) NÃO aparece como senha incorreta", () => {
    expect(classifyAuthError({ status: 401 })).toBe("config");
    expect(loginErrorMessage({ status: 401 }).message).not.toContain("senha incorretos");
    expect(loginErrorMessage({ status: 401 }).message).toContain("Avise a administradora");
  });

  it("URL errada (404) também é configuração", () => {
    expect(classifyAuthError({ status: 404 })).toBe("config");
  });

  it("sem status HTTP é falha de rede", () => {
    expect(classifyAuthError({ status: 0 })).toBe("network");
    expect(classifyAuthError({})).toBe("network");
    expect(loginErrorMessage({ status: 0 }).message).toContain("internet");
  });

  it("limite de tentativas", () => {
    expect(classifyAuthError({ status: 429 })).toBe("rate-limit");
    expect(classifyAuthError({ status: 400, code: "over_request_rate_limit" })).toBe("rate-limit");
  });

  it("erro 500 do servidor não culpa a senha", () => {
    expect(classifyAuthError({ status: 500 })).toBe("unknown");
    expect(LOGIN_MESSAGES.unknown).not.toContain("senha");
  });

  it("outros 400 sem o código de credenciais não viram 'senha incorreta'", () => {
    expect(classifyAuthError({ status: 400, code: "validation_failed" })).toBe("unknown");
    expect(classifyAuthError({ status: 422, code: "weak_password" })).toBe("unknown");
  });
});
