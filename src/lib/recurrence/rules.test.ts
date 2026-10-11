import { describe, expect, it } from "vitest";
import { zonedDateTimeToUtc } from "@/lib/timezone";
import {
  addMonthsClamped,
  describeRule,
  HORIZON_MONTHS,
  horizonEnd,
  isRuleValid,
  MAX_OCCURRENCES,
  nthOccurrence,
  occurrenceDates,
  planOccurrences,
  type RecurrenceRule,
} from "./rules";

const rule = (over: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  frequency: "weekly",
  intervalDays: null,
  startDate: "2026-10-13", // terça-feira
  endDate: null,
  skippedDates: [],
  ...over,
});

describe("meses com dia que não existe", () => {
  it("usa o último dia do mês curto", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2028-01-31", 1)).toBe("2028-02-29"); // bissexto
    expect(addMonthsClamped("2026-01-30", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2026-01-29", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2026-03-31", 1)).toBe("2026-04-30");
  });

  it("vira o ano, para a frente e para trás", () => {
    expect(addMonthsClamped("2026-11-15", 2)).toBe("2027-01-15");
    expect(addMonthsClamped("2026-12-31", 12)).toBe("2027-12-31");
    expect(addMonthsClamped("2026-01-15", -2)).toBe("2025-11-15");
  });

  it("o horizonte é hoje + 6 meses", () => {
    expect(HORIZON_MONTHS).toBe(6);
    expect(horizonEnd("2026-10-10")).toBe("2027-04-10");
    expect(horizonEnd("2026-08-31")).toBe("2027-02-28");
  });
});

describe("semanal", () => {
  it("repete no mesmo dia da semana, de 7 em 7 dias", () => {
    const d = occurrenceDates(rule(), { from: "2026-10-01", until: "2026-11-10" });
    expect(d).toEqual(["2026-10-13", "2026-10-20", "2026-10-27", "2026-11-03", "2026-11-10"]);
  });

  it("6 meses de semanal dão 26 ou 27 atendimentos", () => {
    const d = occurrenceDates(rule({ startDate: "2026-10-10" }), { from: "2026-10-10", until: horizonEnd("2026-10-10") });
    expect(d.length).toBe(27); // de 10/10/2026 a 10/04/2027, inclusive
    expect(d[0]).toBe("2026-10-10");
    expect(d.at(-1)).toBe("2027-04-10");
  });
});

describe("a cada X dias", () => {
  it("de 10 em 10 dias", () => {
    const d = occurrenceDates(rule({ frequency: "every_days", intervalDays: 10 }), { from: "2026-10-01", until: "2026-11-15" });
    expect(d).toEqual(["2026-10-13", "2026-10-23", "2026-11-02", "2026-11-12"]);
  });

  it("de 14 em 14 dias vira a cada duas semanas", () => {
    const d = occurrenceDates(rule({ frequency: "every_days", intervalDays: 14 }), { from: "2026-10-01", until: "2026-11-30" });
    expect(d).toEqual(["2026-10-13", "2026-10-27", "2026-11-10", "2026-11-24"]);
  });

  it("todo dia é aceito e respeita a trava de segurança", () => {
    const d = occurrenceDates(rule({ frequency: "every_days", intervalDays: 1 }), { from: "2026-10-13", until: "2030-01-01" });
    expect(d).toHaveLength(MAX_OCCURRENCES);
  });

  it("X inválido não gera nada", () => {
    expect(occurrenceDates(rule({ frequency: "every_days", intervalDays: 0 }), { from: "2026-10-01", until: "2026-12-31" })).toEqual([]);
    expect(occurrenceDates(rule({ frequency: "every_days", intervalDays: null }), { from: "2026-10-01", until: "2026-12-31" })).toEqual([]);
  });
});

describe("mensal", () => {
  it("mantém o dia do mês", () => {
    const d = occurrenceDates(rule({ frequency: "monthly", startDate: "2026-10-15" }), { from: "2026-10-01", until: "2027-02-28" });
    expect(d).toEqual(["2026-10-15", "2026-11-15", "2026-12-15", "2027-01-15", "2027-02-15"]);
  });

  it("dia 31: meses curtos usam o último dia e os longos voltam ao 31 (sem derivar)", () => {
    const d = occurrenceDates(rule({ frequency: "monthly", startDate: "2026-10-31" }), { from: "2026-10-01", until: "2027-04-30" });
    expect(d).toEqual(["2026-10-31", "2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  });

  it("dia 29 e 30 em fevereiro", () => {
    expect(occurrenceDates(rule({ frequency: "monthly", startDate: "2027-01-29" }), { from: "2027-01-01", until: "2027-03-31" })).toEqual(["2027-01-29", "2027-02-28", "2027-03-29"]);
    expect(occurrenceDates(rule({ frequency: "monthly", startDate: "2027-01-30" }), { from: "2027-01-01", until: "2027-03-31" })).toEqual(["2027-01-30", "2027-02-28", "2027-03-30"]);
    expect(occurrenceDates(rule({ frequency: "monthly", startDate: "2027-12-29" }), { from: "2027-12-01", until: "2028-03-31" })).toEqual(["2027-12-29", "2028-01-29", "2028-02-29", "2028-03-29"]);
  });

  it("nthOccurrence parte sempre da data de início", () => {
    const r = rule({ frequency: "monthly", startDate: "2026-01-31" });
    expect([0, 1, 2, 3].map((n) => nthOccurrence(r, n))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
});

describe("limites da regra", () => {
  it("respeita a data de fim da regra", () => {
    const d = occurrenceDates(rule({ endDate: "2026-10-27" }), { from: "2026-10-01", until: "2027-04-10" });
    expect(d).toEqual(["2026-10-13", "2026-10-20", "2026-10-27"]);
  });

  it("o fim da regra é inclusivo e o horizonte também", () => {
    expect(occurrenceDates(rule({ endDate: "2026-10-20" }), { from: "2026-10-01", until: "2026-12-31" })).toEqual(["2026-10-13", "2026-10-20"]);
    expect(occurrenceDates(rule(), { from: "2026-10-01", until: "2026-10-20" })).toEqual(["2026-10-13", "2026-10-20"]);
  });

  it("pula as datas marcadas para pular", () => {
    const d = occurrenceDates(rule({ skippedDates: ["2026-10-20", "2026-11-03"] }), { from: "2026-10-01", until: "2026-11-10" });
    expect(d).toEqual(["2026-10-13", "2026-10-27", "2026-11-10"]);
  });

  it("'from' repõe só o que falta, sem mudar o ritmo", () => {
    const d = occurrenceDates(rule(), { from: "2026-11-01", until: "2026-11-30" });
    expect(d).toEqual(["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]);
  });

  it("início depois do horizonte não gera nada", () => {
    expect(occurrenceDates(rule({ startDate: "2027-06-01" }), { from: "2026-10-10", until: "2027-04-10" })).toEqual([]);
  });

  it("repor duas vezes dá as mesmas datas (idempotente)", () => {
    const range = { from: "2026-10-10", until: "2027-04-10" };
    expect(occurrenceDates(rule(), range)).toEqual(occurrenceDates(rule(), range));
  });
});

describe("conferência antes de criar", () => {
  const busy = [
    { startAt: zonedDateTimeToUtc("2026-10-20", "10:00").toISOString(), endAt: zonedDateTimeToUtc("2026-10-20", "10:40").toISOString() },
  ];

  it("marca como conflito só a data que cruza outro atendimento", () => {
    const plan = planOccurrences(rule(), "10:00", 45, busy, { from: "2026-10-13", until: "2026-10-27" });
    expect(plan.map((p) => [p.date, p.conflict])).toEqual([["2026-10-13", false], ["2026-10-20", true], ["2026-10-27", false]]);
  });

  it("calcula início e fim em UTC pelo horário do salão (UTC-3)", () => {
    const [p] = planOccurrences(rule(), "10:00", 45, [], { from: "2026-10-13", until: "2026-10-13" });
    expect(p.startAt).toBe("2026-10-13T13:00:00.000Z");
    expect(p.endAt).toBe("2026-10-13T13:45:00.000Z");
    expect(p.time).toBe("10:00");
  });

  it("atendimento que termina exatamente quando o outro começa não é conflito", () => {
    const plan = planOccurrences(rule(), "09:20", 40, busy, { from: "2026-10-20", until: "2026-10-20" }); // 09:20–10:00
    expect(plan[0].conflict).toBe(false);
  });
});

describe("texto da regra e validação", () => {
  it("descreve em português", () => {
    expect(describeRule(rule())).toBe("Toda terça-feira");
    expect(describeRule(rule({ startDate: "2026-10-10" }))).toBe("Todo sábado");
    expect(describeRule(rule({ startDate: "2026-10-11" }))).toBe("Todo domingo");
    expect(describeRule(rule({ frequency: "monthly", startDate: "2026-10-15" }))).toBe("Todo dia 15");
    expect(describeRule(rule({ frequency: "monthly", startDate: "2026-10-31" }))).toBe("Todo mês, no dia 31 (ou no último dia)");
    expect(describeRule(rule({ frequency: "every_days", intervalDays: 10 }))).toBe("A cada 10 dias");
    expect(describeRule(rule({ frequency: "every_days", intervalDays: 1 }))).toBe("Todos os dias");
  });

  it("valida a regra", () => {
    expect(isRuleValid(rule())).toBe(true);
    expect(isRuleValid(rule({ frequency: "every_days", intervalDays: 10 }))).toBe(true);
    expect(isRuleValid(rule({ frequency: "every_days", intervalDays: 365 }))).toBe(true);
    expect(isRuleValid(rule({ frequency: "every_days", intervalDays: 366 }))).toBe(false);
    expect(isRuleValid(rule({ frequency: "every_days", intervalDays: 0 }))).toBe(false);
    expect(isRuleValid(rule({ frequency: "every_days", intervalDays: 2.5 }))).toBe(false);
    expect(isRuleValid(rule({ frequency: "every_days", intervalDays: null }))).toBe(false);
    expect(isRuleValid(rule({ frequency: "weekly", intervalDays: 7 }))).toBe(false); // X só vale em "a cada X dias"
    expect(isRuleValid(rule({ startDate: "2026-02-31" }))).toBe(false);
    expect(isRuleValid(rule({ endDate: "2026-10-01" }))).toBe(false); // fim antes do início
    expect(isRuleValid(rule({ endDate: "2026-10-13" }))).toBe(true); // fim no próprio dia de início
  });
});
