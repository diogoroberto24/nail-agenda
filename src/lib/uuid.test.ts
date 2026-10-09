import { afterEach, describe, expect, it, vi } from "vitest";
import { newUuid } from "./uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const realCrypto = globalThis.crypto;

afterEach(() => vi.unstubAllGlobals());

describe("newUuid", () => {
  it("gera UUID v4 válido e únicos", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newUuid()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(V4);
  });

  it("funciona sem crypto.randomUUID (http na rede local, sem contexto seguro)", () => {
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => realCrypto.getRandomValues(a) });
    expect(newUuid()).toMatch(V4);
  });
});
