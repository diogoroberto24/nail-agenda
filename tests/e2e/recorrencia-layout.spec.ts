import { expect, test } from "@playwright/test";
import { expectLayoutOk } from "./measure";
import { MARK, adminClient, readFixture } from "./helpers";

/** Telas da recorrência nas larguras 320, 360, 390, 430, tablet e desktop. Exige a migração 20261012000001. */
test("Recorrência: ficha, formulário, conferência das datas e página da recorrência", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  const fx = readFixture();
  const admin = adminClient();
  // as execuções anteriores (outras larguras) deixaram recorrências e os atendimentos que o app repôs: começa limpo
  const { data: old } = await admin.from("recurrences").select("id").eq("client_id", fx.clientId);
  const oldIds = (old ?? []).map((r) => r.id);
  if (oldIds.length) {
    await admin.from("appointments").delete().in("recurrence_id", oldIds);
    await admin.from("recurrences").delete().in("id", oldIds);
  }
  const { data: svc } = await admin.from("services").select("id").eq("professional_id", fx.proA.id).like("name", `${MARK}%`).limit(1).single();
  const { data: rec, error } = await admin
    .from("recurrences")
    .insert({
      salon_id: fx.salonId, professional_id: fx.proA.id, client_id: fx.clientId, service_id: svc!.id,
      frequency: "monthly", start_date: fx.tomorrow, start_time: "06:15", duration_minutes: 40, price: 50, created_by: (await admin.from("professionals").select("user_id").eq("id", fx.proA.id).single()).data!.user_id,
    })
    .select("id")
    .single();
  expect(error).toBeNull();

  // ficha com a seção Recorrência
  await page.goto(`/clientes/${fx.clientId}`);
  await expect(page.getByRole("heading", { name: "Recorrência" })).toBeVisible();
  await expect(page.getByRole("link", { name: /às 06:15/ })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expectLayoutOk(page);

  // página da recorrência
  await page.goto(`/recorrencias/${rec!.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Recorrência" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expectLayoutOk(page);

  // formulário vazio e com erros
  await page.goto(`/clientes/${fx.clientId}/recorrencia/nova`);
  await expect(page.getByRole("heading", { level: 1, name: "Nova recorrência" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expectLayoutOk(page);
  await page.getByRole("button", { name: "Ver as datas" }).click();
  await expect(page.getByText("Escolha o serviço.")).toBeVisible();
  await expectLayoutOk(page);

  // "a cada X dias" aberto + conferência das datas
  await page.getByRole("radio", { name: "A cada X dias" }).click();
  await page.getByRole("radio", { name: new RegExp(`${MARK} Esmaltação`) }).click();
  await page.getByLabel("Primeiro atendimento").filter({ visible: true }).fill(fx.tomorrow);
  await page.getByLabel("Horário").filter({ visible: true }).fill("05:10");
  await page.getByLabel("De quantos em quantos dias").filter({ visible: true }).fill("10");
  await expectLayoutOk(page);
  await page.getByRole("button", { name: "Ver as datas" }).click();
  await expect(page.getByRole("heading", { name: "Datas dos próximos 6 meses" })).toBeVisible();
  await expectLayoutOk(page); // lista longa de datas: sem rolagem lateral, alvos de 44 px e botões acima da barra

  expect(errors, `erros no console: ${errors.join(" | ")}`).toEqual([]);
});
