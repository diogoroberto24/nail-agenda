import { describe, expect, it } from "vitest";
import { addDays, startOfWeek, weekdayOf, zonedDateTimeToUtc } from "@/lib/timezone";
import { classifySlots, endOf, generateSlotTimes, overlapsBusy, slotState, weekDaysMondayFirst, weekHeaderLabel, type BusyInterval } from "./slots";

const DAY = "2026-11-10"; // terça-feira
const at = (time: string) => zonedDateTimeToUtc(DAY, time);
const busy = (from: string, to: string): BusyInterval => ({ startAt: at(from).toISOString(), endAt: at(to).toISOString() });
const BEFORE_OPENING = zonedDateTimeToUtc("2026-11-10", "06:00"); // "agora", antes de começar o dia

describe("grade de horários", () => {
  it("vai das 08:00 às 19:30, de 30 em 30 minutos (24 horários), e o último termina às 20:00", () => {
    const slots = generateSlotTimes();
    expect(slots).toHaveLength(24);
    expect(slots[0]).toBe("08:00");
    expect(slots[1]).toBe("08:30");
    expect(slots.at(-1)).toBe("19:30");
    expect(slots).not.toContain("20:00");
  });

  it("aceita outro início, fim e passo", () => {
    expect(generateSlotTimes("09:00", "10:30", 30)).toEqual(["09:00", "09:30", "10:00"]);
    expect(generateSlotTimes("09:00", "11:00", 60)).toEqual(["09:00", "10:00"]);
  });
});

describe("horário ocupado, de acordo com a duração", () => {
  const b = [busy("10:00", "10:40")];

  it("cruzar o atendimento existente deixa o horário indisponível", () => {
    expect(overlapsBusy(DAY, "10:00", 30, b)).toBe(true);
    expect(overlapsBusy(DAY, "10:30", 30, b)).toBe(true); // começa dentro
    expect(overlapsBusy(DAY, "09:30", 45, b)).toBe(true); // termina dentro (09:30 + 45 = 10:15)
  });

  it("atendimentos consecutivos não cruzam (fim = início)", () => {
    expect(overlapsBusy(DAY, "10:40", 30, b)).toBe(false);
    expect(overlapsBusy(DAY, "09:30", 30, b)).toBe(false); // termina exatamente às 10:00
  });

  it("a duração muda o resultado: o mesmo horário pode estar livre para 30 min e ocupado para 60 ou mais", () => {
    expect(overlapsBusy(DAY, "09:00", 60, b)).toBe(false); // 09:00–10:00
    expect(overlapsBusy(DAY, "09:00", 90, b)).toBe(true); // 09:00–10:30
    expect(overlapsBusy(DAY, "09:30", 30, b)).toBe(false);
    expect(overlapsBusy(DAY, "09:30", 31, b)).toBe(true);
  });

  it("sem nada ocupado, tudo livre", () => {
    expect(overlapsBusy(DAY, "10:00", 60, [])).toBe(false);
  });

  it("vários atendimentos no dia: basta cruzar um", () => {
    const many = [busy("09:00", "09:40"), busy("14:00", "15:00")];
    expect(overlapsBusy(DAY, "14:30", 30, many)).toBe(true);
    expect(overlapsBusy(DAY, "11:00", 30, many)).toBe(false);
  });
});

describe("estado de cada horário (livre, ocupado ou passado)", () => {
  it("horário passado hoje fica 'past', mesmo se estiver livre", () => {
    const now = zonedDateTimeToUtc(DAY, "10:15");
    expect(slotState(DAY, "09:30", 30, [], now)).toBe("past");
    expect(slotState(DAY, "10:00", 30, [], now)).toBe("past");
    expect(slotState(DAY, "10:30", 30, [], now)).toBe("available");
  });

  it("o horário exatamente agora ainda é válido; um minuto antes, não", () => {
    const now = zonedDateTimeToUtc(DAY, "10:00");
    expect(slotState(DAY, "10:00", 30, [], now)).toBe("available");
    expect(slotState(DAY, "09:30", 30, [], now)).toBe("past");
  });

  it("dias anteriores ficam todos 'past'; dias futuros, todos livres sem agenda", () => {
    const now = zonedDateTimeToUtc(DAY, "10:00");
    expect(classifySlots("2026-11-09", 30, [], now).every((s) => s.state === "past")).toBe(true);
    expect(classifySlots("2026-11-11", 30, [], now).every((s) => s.state === "available")).toBe(true);
  });

  it("'passado' tem prioridade sobre 'ocupado'", () => {
    const now = zonedDateTimeToUtc(DAY, "12:00");
    expect(slotState(DAY, "10:00", 30, [busy("10:00", "10:40")], now)).toBe("past");
  });

  it("no futuro, o ocupado aparece como 'busy'", () => {
    const now = zonedDateTimeToUtc("2026-11-09", "12:00");
    expect(slotState(DAY, "10:00", 30, [busy("10:00", "10:40")], now)).toBe("busy");
    expect(slotState(DAY, "11:00", 30, [busy("10:00", "10:40")], now)).toBe("available");
  });
});

describe("classificação da grade inteira", () => {
  it("com um atendimento 10:00–10:40 e duração de 40 min", () => {
    const slots = classifySlots(DAY, 40, [busy("10:00", "10:40")], BEFORE_OPENING);
    const s = Object.fromEntries(slots.map((x) => [x.time, x.state]));
    expect(s["08:00"]).toBe("available");
    expect(s["09:00"]).toBe("available"); // 09:00–09:40
    expect(s["09:30"]).toBe("busy"); // 09:30–10:10
    expect(s["10:00"]).toBe("busy");
    expect(s["10:30"]).toBe("busy"); // 10:30–11:10 cruza até 10:40
    expect(s["11:00"]).toBe("available");
  });

  it("uma duração maior bloqueia mais horários antes do atendimento existente", () => {
    const b = [busy("10:00", "10:40")];
    const short = classifySlots(DAY, 30, b, BEFORE_OPENING).filter((s) => s.state === "busy").length;
    const long = classifySlots(DAY, 120, b, BEFORE_OPENING).filter((s) => s.state === "busy").length;
    expect(long).toBeGreaterThan(short);
  });
});

describe("término do atendimento", () => {
  it("calcula o horário final", () => {
    expect(endOf(DAY, "09:30", 45)).toEqual({ time: "10:15", nextDay: false });
    expect(endOf(DAY, "19:30", 30)).toEqual({ time: "20:00", nextDay: false });
  });

  it("avisa quando passa da meia-noite", () => {
    expect(endOf(DAY, "23:30", 60)).toEqual({ time: "00:30", nextDay: true });
  });
});

describe("semana de segunda a domingo", () => {
  it("devolve 7 dias, de segunda a domingo", () => {
    const days = weekDaysMondayFirst("2026-11-10");
    expect(days.map((d) => d.date)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
    expect(days.map((d) => d.weekday)).toEqual(["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]);
    expect(days[0].dayNumber).toBe(9);
  });

  it("a semana de um domingo termina nele (não começa nele)", () => {
    const days = weekDaysMondayFirst("2026-11-15"); // domingo
    expect(days[0].date).toBe("2026-11-09");
    expect(days[6].date).toBe("2026-11-15");
  });

  it("startOfWeek aceita segunda como primeiro dia, sem mudar o padrão (domingo)", () => {
    expect(weekdayOf(startOfWeek("2026-11-10", 1))).toBe(1);
    expect(weekdayOf(startOfWeek("2026-11-10"))).toBe(0);
    expect(startOfWeek("2026-11-10")).toBe("2026-11-08");
    expect(startOfWeek("2026-11-09", 1)).toBe("2026-11-09");
    expect(startOfWeek("2026-11-15", 1)).toBe("2026-11-09");
  });

  it("o título mostra o mês; atravessando meses ou anos, mostra os dois", () => {
    expect(weekHeaderLabel(weekDaysMondayFirst("2026-11-10"))).toBe("Novembro 2026");
    expect(weekHeaderLabel(weekDaysMondayFirst("2026-10-29"))).toBe("Out – Nov 2026"); // 26/10 a 01/11
    expect(weekHeaderLabel(weekDaysMondayFirst("2026-12-31"))).toBe("Dez 2026 – Jan 2027"); // 28/12 a 03/01
  });

  it("andar uma semana é somar 7 dias", () => {
    expect(weekDaysMondayFirst(addDays("2026-11-10", 7))[0].date).toBe("2026-11-16");
  });
});
