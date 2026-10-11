import { expect, test } from "@playwright/test";
import { MARK, adminClient, readFixture } from "./helpers";
import {
  addDays,
  startOfWeek,
  zonedDateTimeToUtc,
} from "../../src/lib/timezone";

/**
 * Início: os atendimentos de uma recorrência só aparecem se forem da semana atual (segunda a domingo).
 * Os 6 meses reservados à frente não enchem "Próximos atendimentos". Exige a migração 20261012000001.
 */
test("Início mostra da recorrência só a semana atual; atendimentos avulsos continuam como antes", async ({
  page,
}) => {
  const fx = readFixture();
  const admin = adminClient();
  const userId = (
    await admin
      .from("professionals")
      .select("user_id")
      .eq("id", fx.proA.id)
      .single()
  ).data!.user_id;
  const svc = (
    await admin
      .from("services")
      .select("id")
      .eq("professional_id", fx.proA.id)
      .like("name", `${MARK}%`)
      .limit(1)
      .single()
  ).data!.id;

  // recorrência semanal criada direto no banco; as ocorrências: hoje (23:20), na semana que vem e na seguinte
  const rec = (
    await admin
      .from("recurrences")
      .insert({
        salon_id: fx.salonId,
        professional_id: fx.proA.id,
        client_id: fx.clientId,
        service_id: svc,
        frequency: "weekly",
        start_date: fx.today,
        start_time: "23:20",
        duration_minutes: 30,
        price: 50,
        created_by: userId,
      })
      .select("id")
      .single()
  ).data!.id;

  const nextMonday = addDays(startOfWeek(fx.today, 1), 7);
  const occurrences = [
    fx.today,
    nextMonday,
    addDays(nextMonday, 7),
    addDays(nextMonday, 14),
  ];
  for (const date of occurrences) {
    const start = zonedDateTimeToUtc(date, "23:20");
    const { error } = await admin.from("appointments").insert({
      salon_id: fx.salonId,
      professional_id: fx.proA.id,
      client_id: fx.clientId,
      service_id: svc,
      start_at: start.toISOString(),
      end_at: new Date(start.getTime() + 30 * 60_000).toISOString(),
      duration_minutes_at_booking: 30,
      price_at_booking: 50,
      created_by: userId,
      recurrence_id: rec,
      occurrence_date: date,
    });
    expect(error).toBeNull();
  }

  try {
    await page.goto("/");
    const lista = page
      .getByRole("heading", { name: "Próximos atendimentos" })
      .locator("xpath=ancestor::section[1]");
    await expect(lista).toBeVisible();

    // a recorrência de HOJE aparece, com a etiqueta
    const deHoje = lista
      .locator("li")
      .filter({ hasText: "23:20" })
      .filter({ hasText: "Recorrente" });
    await expect(deHoje).toHaveCount(1);

    // as das semanas seguintes NÃO aparecem
    await expect(
      lista.locator("li").filter({ hasText: "Recorrente" }),
    ).toHaveCount(1);

    // atendimento avulso (o da fixture, hoje às 23:00) continua aparecendo e não tem a etiqueta
    const avulso = lista.locator("li").filter({ hasText: "23:00" });
    await expect(avulso.first()).toBeVisible();
    await expect(avulso.first().getByText("Recorrente")).toHaveCount(0);

    // e a agenda do dia da semana que vem continua mostrando a recorrência normalmente
    await page.goto(`/agenda?data=${nextMonday}`);
    await expect(
      page
        .locator("li")
        .filter({ hasText: "23:20" })
        .filter({ hasText: "Recorrente" }),
    ).toBeVisible();
  } finally {
    // não deixa recorrência para os outros testes (a abertura do app também repõe atendimentos da série)
    await admin.from("appointments").delete().eq("recurrence_id", rec);
    await admin.from("recurrences").delete().eq("id", rec);
  }
});
