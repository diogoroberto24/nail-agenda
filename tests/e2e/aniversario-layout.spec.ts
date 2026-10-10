import { expect, test } from "@playwright/test";
import { expectLayoutOk } from "./measure";
import { MARK, adminClient, readFixture } from "./helpers";

/** "Aniversariantes de hoje" no Início e o campo de aniversário nas larguras 320, 360, 390, 430, tablet e desktop. */
test("Aniversariantes de hoje e campo Aniversário", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  const fx = readFixture();
  const [, month, day] = fx.today.split("-");
  const admin = adminClient();
  // nome longo de propósito: precisa truncar sem estourar a largura
  const name = `${MARK} Aniversariante com um nome bem comprido para testar o corte ${info.project.name}`;
  const { error } = await admin.from("clients").insert({
    salon_id: fx.salonId,
    full_name: name,
    phone: "5511977770001",
    birth_day: Number(day),
    birth_month: Number(month),
    birth_year: 1990,
  });
  expect(error).toBeNull();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Aniversariantes de hoje" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enviar parabéns" }).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expectLayoutOk(page);

  await page.goto("/clientes/novo");
  await expect(page.getByLabel(/Aniversário/).filter({ visible: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expectLayoutOk(page);

  expect(errors, `erros no console: ${errors.join(" | ")}`).toEqual([]);
});
