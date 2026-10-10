import { describe, expect, it } from "vitest";
import {
  birthdayPairsFor,
  birthdayText,
  birthdayToColumns,
  formatBirthday,
  isBirthdayToday,
  isLeapYear,
  parseBirthday,
  turningAge,
} from "./birthday";

const NOW = 2026;

describe("parseBirthday", () => {
  it.each([
    ["15/03", { day: 15, month: 3, year: null }],
    ["5/3", { day: 5, month: 3, year: null }],
    ["15-03", { day: 15, month: 3, year: null }],
    ["15.03", { day: 15, month: 3, year: null }],
    ["1503", { day: 15, month: 3, year: null }],
    ["15/03/1990", { day: 15, month: 3, year: 1990 }],
    ["15-03-1990", { day: 15, month: 3, year: 1990 }],
    ["15031990", { day: 15, month: 3, year: 1990 }],
    ["  15 / 03 ", { day: 15, month: 3, year: null }],
    ["29/02", { day: 29, month: 2, year: null }],
    ["29/02/2000", { day: 29, month: 2, year: 2000 }],
    ["31/12/2026", { day: 31, month: 12, year: 2026 }],
  ])("aceita %s", (input, expected) => {
    expect(parseBirthday(input, NOW)).toEqual(expected);
  });

  it.each([
    "", "   ", "abc", "15", "15/", "/03", "32/01", "00/05", "10/13", "10/00", "31/04", "30/02", "31/06",
    "29/02/1900", "29/02/2001", "15/03/90", "15/03/19900", "15/03/1899", "15/03/2027", "15/03/1990/1", "15/ab", "15031", "1503199",
  ])("recusa %j", (input) => {
    expect(parseBirthday(input, NOW)).toBeNull();
  });

  it("anos bissextos", () => {
    expect([1900, 2000, 2024, 2025, 2100].map(isLeapYear)).toEqual([false, true, true, false, false]);
  });
});

describe("formatação e colunas do banco", () => {
  it("formata com e sem ano, com zero à esquerda", () => {
    expect(formatBirthday({ day: 5, month: 3, year: null })).toBe("05/03");
    expect(formatBirthday({ day: 15, month: 3, year: 1990 })).toBe("15/03/1990");
  });

  it("do formulário para as colunas e de volta", () => {
    expect(birthdayToColumns("15/03/1990")).toEqual({ birth_day: 15, birth_month: 3, birth_year: 1990 });
    expect(birthdayToColumns("15/03")).toEqual({ birth_day: 15, birth_month: 3, birth_year: null });
    expect(birthdayToColumns("")).toEqual({ birth_day: null, birth_month: null, birth_year: null });
    expect(birthdayToColumns(undefined)).toEqual({ birth_day: null, birth_month: null, birth_year: null });
    expect(birthdayText({ birth_day: 15, birth_month: 3, birth_year: 1990 })).toBe("15/03/1990");
    expect(birthdayText({ birth_day: 5, birth_month: 3, birth_year: null })).toBe("05/03");
    expect(birthdayText({ birth_day: null, birth_month: null, birth_year: null })).toBe("");
  });
});

describe("aniversário hoje", () => {
  const row = (d: number | null, m: number | null) => ({ birth_day: d, birth_month: m });

  it("compara dia e mês com a data de hoje", () => {
    expect(isBirthdayToday(row(10, 10), "2026-10-10")).toBe(true);
    expect(isBirthdayToday(row(11, 10), "2026-10-10")).toBe(false);
    expect(isBirthdayToday(row(10, 11), "2026-10-10")).toBe(false);
    expect(isBirthdayToday(row(null, null), "2026-10-10")).toBe(false);
  });

  it("quem faz aniversário em 29/02 é lembrada em 28/02 nos anos que não são bissextos, e só em 29/02 nos bissextos", () => {
    expect(isBirthdayToday(row(29, 2), "2026-02-28")).toBe(true);
    expect(isBirthdayToday(row(29, 2), "2028-02-28")).toBe(false);
    expect(isBirthdayToday(row(29, 2), "2028-02-29")).toBe(true);
    expect(isBirthdayToday(row(28, 2), "2026-02-28")).toBe(true);
    expect(birthdayPairsFor("2026-02-28")).toEqual([{ day: 28, month: 2 }, { day: 29, month: 2 }]);
    expect(birthdayPairsFor("2026-03-01")).toEqual([{ day: 1, month: 3 }]);
  });

  it("idade que faz hoje, só se o ano foi informado", () => {
    expect(turningAge(1990, "2026-03-15")).toBe(36);
    expect(turningAge(null, "2026-03-15")).toBeNull();
    expect(turningAge(2026, "2026-03-15")).toBeNull();
  });
});
