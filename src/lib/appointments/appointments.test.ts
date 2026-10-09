import { describe, expect, it } from "vitest";
import {
  addDays,
  formatLongDate,
  formatShortWeekday,
  formatTime,
  isValidDateString,
  isValidTimeString,
  startOfWeek,
  todayInZone,
  toZonedParts,
  weekdayOf,
  zonedDateTimeToUtc,
  zonedDayRange,
} from "@/lib/timezone";
import { findOverlaps, intervalsOverlap, occupiesSlot } from "./conflicts";
import { appointmentSchema, toAppointmentRow, toAppointmentTimes } from "./schema";

const SP = "America/Sao_Paulo";

describe("datas no fuso do salão", () => {
  it("converte 10:00 de São Paulo para UTC (UTC-3 em 2026) e volta", () => {
    const utc = zonedDateTimeToUtc("2026-11-10", "10:00", SP);
    expect(utc.toISOString()).toBe("2026-11-10T13:00:00.000Z");
    expect(toZonedParts(utc, SP)).toEqual({ date: "2026-11-10", time: "10:00" });
  });

  it("não depende do fuso do aparelho: 23:30 em SP já é o dia seguinte em UTC", () => {
    const utc = zonedDateTimeToUtc("2026-11-10", "23:30", SP);
    expect(utc.toISOString()).toBe("2026-11-11T02:30:00.000Z");
    expect(toZonedParts(utc, SP).date).toBe("2026-11-10");
    expect(todayInZone(SP, new Date("2026-11-11T02:30:00Z"))).toBe("2026-11-10");
    expect(todayInZone(SP, new Date("2026-11-11T03:00:00Z"))).toBe("2026-11-11");
  });

  it("trata horário de verão histórico (SP tinha UTC-2 em dez/2018)", () => {
    expect(zonedDateTimeToUtc("2018-12-10", "10:00", SP).toISOString()).toBe("2018-12-10T12:00:00.000Z");
    expect(zonedDateTimeToUtc("2018-07-10", "10:00", SP).toISOString()).toBe("2018-07-10T13:00:00.000Z");
  });

  it("o intervalo do dia é [00:00, 00:00 do dia seguinte) no fuso do salão", () => {
    const { start, end } = zonedDayRange("2026-11-10", SP);
    expect(start.toISOString()).toBe("2026-11-10T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-11T03:00:00.000Z");
    // um atendimento às 23:30 de SP pertence ao dia 10, e às 00:00 do dia 11 não
    const late = zonedDateTimeToUtc("2026-11-10", "23:30", SP);
    const midnight = zonedDateTimeToUtc("2026-11-11", "00:00", SP);
    expect(late >= start && late < end).toBe(true);
    expect(midnight >= end).toBe(true);
  });

  it("aritmética de dias atravessa fim de mês e de ano", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("semana começa no domingo", () => {
    expect(weekdayOf("2026-11-10")).toBe(2); // terça
    expect(startOfWeek("2026-11-10")).toBe("2026-11-08");
    expect(startOfWeek("2026-11-08")).toBe("2026-11-08");
  });

  it("valida datas e horas", () => {
    expect(isValidDateString("2026-02-29")).toBe(false);
    expect(isValidDateString("2028-02-29")).toBe(true);
    expect(isValidDateString("2026-13-01")).toBe(false);
    expect(isValidDateString("10/11/2026")).toBe(false);
    expect(isValidTimeString("09:05")).toBe(true);
    expect(isValidTimeString("24:00")).toBe(false);
    expect(isValidTimeString("9:05")).toBe(false);
  });

  it("formata para a tela em português", () => {
    expect(formatLongDate("2026-11-10")).toBe("terça-feira, 10 de novembro");
    expect(formatShortWeekday("2026-11-10")).toBe("ter");
    expect(formatTime("2026-11-10T13:00:00Z", SP)).toBe("10:00");
  });
});

describe("sobreposição de horários (intervalos semiabertos)", () => {
  const t = (hhmm: string) => zonedDateTimeToUtc("2026-11-10", hhmm, SP);

  it("detecta sobreposição parcial, total e contida", () => {
    expect(intervalsOverlap(t("10:00"), t("10:40"), t("10:20"), t("11:00"))).toBe(true);
    expect(intervalsOverlap(t("10:00"), t("11:00"), t("10:00"), t("11:00"))).toBe(true);
    expect(intervalsOverlap(t("10:00"), t("12:00"), t("10:30"), t("11:00"))).toBe(true);
  });

  it("atendimentos consecutivos NÃO se sobrepõem", () => {
    expect(intervalsOverlap(t("10:00"), t("10:40"), t("10:40"), t("11:20"))).toBe(false);
    expect(intervalsOverlap(t("10:40"), t("11:20"), t("10:00"), t("10:40"))).toBe(false);
  });

  it("intervalos distantes não se sobrepõem", () => {
    expect(intervalsOverlap(t("08:00"), t("09:00"), t("10:00"), t("11:00"))).toBe(false);
  });

  const appt = (id: string, from: string, to: string, status: "confirmed" | "cancelled" | "no_show" | "completed" | "awaiting_confirmation") => ({
    id,
    start_at: t(from).toISOString(),
    end_at: t(to).toISOString(),
    status,
  });

  it("só atendimentos que ocupam horário contam; cancelado e não compareceu liberam", () => {
    expect(occupiesSlot("cancelled")).toBe(false);
    expect(occupiesSlot("no_show")).toBe(false);
    for (const s of ["awaiting_confirmation", "confirmed", "completed"] as const) expect(occupiesSlot(s)).toBe(true);

    const others = [
      appt("a", "10:00", "10:40", "confirmed"),
      appt("b", "10:10", "10:50", "cancelled"),
      appt("c", "10:20", "11:00", "no_show"),
      appt("d", "11:00", "11:30", "awaiting_confirmation"),
    ];
    const found = findOverlaps(t("10:30"), t("11:10"), others);
    expect(found.map((o) => o.id).sort()).toEqual(["a", "d"]);
  });

  it("ao editar, o próprio atendimento é ignorado", () => {
    const others = [appt("a", "10:00", "10:40", "confirmed")];
    expect(findOverlaps(t("10:10"), t("10:50"), others, "a")).toHaveLength(0);
    expect(findOverlaps(t("10:10"), t("10:50"), others)).toHaveLength(1);
  });
});

describe("appointmentSchema", () => {
  const ok = {
    clientId: "30000000-0000-0000-0000-000000000001",
    serviceId: "40000000-0000-0000-0000-00000000000a",
    date: "2026-11-10",
    time: "10:00",
    durationMinutes: "40",
    price: "50,00",
    notes: "",
  };

  it("aceita dados válidos e calcula horário final = início + duração", () => {
    const row = toAppointmentRow(appointmentSchema.parse(ok), SP);
    expect(row.start_at).toBe("2026-11-10T13:00:00.000Z");
    expect(row.end_at).toBe("2026-11-10T13:40:00.000Z");
    expect(row.duration_minutes_at_booking).toBe(40);
    expect(row.price_at_booking).toBe(50);
    expect(row.notes).toBeNull();
  });

  it("a duração editada vale só para este atendimento", () => {
    const { start, end, minutes } = toAppointmentTimes({ ...ok, durationMinutes: "75" }, SP);
    expect(minutes).toBe(75);
    expect(end.getTime() - start.getTime()).toBe(75 * 60_000);
  });

  it("atendimento que atravessa a meia-noite termina no dia seguinte", () => {
    const { end } = toAppointmentTimes({ ...ok, time: "23:30", durationMinutes: "60" }, SP);
    expect(toZonedParts(end, SP)).toEqual({ date: "2026-11-11", time: "00:30" });
  });

  it("recusa cliente/serviço ausentes, data e hora inválidas, duração e preço fora do limite", () => {
    for (const bad of [
      { clientId: "" },
      { serviceId: "x" },
      { date: "2026-02-30" },
      { time: "25:00" },
      { durationMinutes: "0" },
      { durationMinutes: "abc" },
      { price: "-1" },
      { price: "100000" },
      { notes: "x".repeat(501) },
    ]) {
      expect(appointmentSchema.safeParse({ ...ok, ...bad }).success).toBe(false);
    }
  });
});
