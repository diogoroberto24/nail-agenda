import { describe, expect, it } from "vitest";
import { buildClientSearchFilter } from "./search";

describe("buildClientSearchFilter", () => {
  it("texto vazio ou só símbolos de sintaxe não gera filtro", () => {
    expect(buildClientSearchFilter("")).toBeNull();
    expect(buildClientSearchFilter("   ")).toBeNull();
    expect(buildClientSearchFilter(',()*"\\')).toBeNull();
  });

  it("nome: busca por trecho, sem diferenciar maiúsculas (ilike)", () => {
    expect(buildClientSearchFilter("maria")).toBe("full_name.ilike.*maria*");
  });

  it("com 3 ou mais dígitos, também busca no telefone (qualquer formato digitado)", () => {
    // parênteses viram espaço no nome; o telefone usa só os dígitos
    expect(buildClientSearchFilter("(11) 98888")).toBe("full_name.ilike.*11 98888*,phone.ilike.*1198888*");
    expect(buildClientSearchFilter("Ana 12")).toBe("full_name.ilike.*Ana 12*"); // só 2 dígitos: não vira telefone
  });

  it("caracteres da sintaxe do filtro nunca vazam para o filtro (injeção)", () => {
    const f = buildClientSearchFilter("ana,archived_at.is.null)")!;
    expect(f).toBe("full_name.ilike.*ana archived\\_at.is.null*"); // o _ também é escapado
    expect(f.split(",")).toHaveLength(1); // nenhuma condição extra
  });

  it("curingas do LIKE são escapados: _ e % valem como texto, não como curinga", () => {
    expect(buildClientSearchFilter("Ana_Maria")).toBe("full_name.ilike.*Ana\\_Maria*");
    // os 3 dígitos de "100" também buscam no telefone
    expect(buildClientSearchFilter("100%")).toBe("full_name.ilike.*100\\%*,phone.ilike.*100*");
  });
});
