import { describe, expect, it } from "vitest";
import { limitRecurrencesToWeek, recurrenceWeekFilter, weekEndUtc } from "./home-week";

describe("fim da semana atual (segunda a domingo)", () => {
  it.each([
    ["2026-10-05", "2026-10-12"], // segunda
    ["2026-10-07", "2026-10-12"], // quarta
    ["2026-10-10", "2026-10-12"], // sábado
    ["2026-10-11", "2026-10-12"], // domingo: ainda é a semana que começou na segunda 05/10
    ["2026-10-12", "2026-10-19"], // a segunda seguinte já é outra semana
    ["2026-12-31", "2027-01-04"], // virada de ano
  ])("hoje %s → a semana termina na segunda %s às 00:00 (horário de São Paulo)", (today, nextMonday) => {
    // 00:00 de São Paulo (UTC-3) = 03:00 UTC
    expect(weekEndUtc(today).toISOString()).toBe(`${nextMonday}T03:00:00.000Z`);
  });
});

describe("filtro de recorrência na tela Início", () => {
  it("deixa passar o atendimento avulso ou o de recorrência que começa antes do fim da semana", () => {
    const until = new Date("2026-10-12T03:00:00.000Z");
    expect(recurrenceWeekFilter(until)).toBe("recurrence_id.is.null,start_at.lt.2026-10-12T03:00:00.000Z");
  });

  it("aplica o filtro na consulta recebida e devolve a mesma consulta (encadeável)", () => {
    const calls: string[] = [];
    const q = { or(f: string) { calls.push(f); return q; } };
    expect(limitRecurrencesToWeek(q, new Date("2026-10-12T03:00:00.000Z"))).toBe(q);
    expect(calls).toEqual(["recurrence_id.is.null,start_at.lt.2026-10-12T03:00:00.000Z"]);
  });
});
