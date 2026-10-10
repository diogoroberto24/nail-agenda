import { expect, test } from "@playwright/test";
import { expectLayoutOk } from "./measure";
import { MARK, readFixture } from "./helpers";

/** Etapa 4, aviso de horário ocupado e tela de sucesso nas larguras 320, 360, 390, 430, tablet e desktop. */
test("Etapa 4 (Detalhes), aviso de horário ocupado e tela de sucesso", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const fx = readFixture();

  await page.goto("/agendamentos/novo?data=2031-12-10&hora=15:00");
  await page.getByRole("button", { name: new RegExp(fx.clientName) }).first().click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("button", { name: new RegExp(`${MARK} Esmaltação`) }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.getByRole("button", { name: "15:00", pressed: true })).toBeVisible();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "4. Detalhes adicionais" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expectLayoutOk(page);

  await page.getByRole("button", { name: "Agendar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Horário ocupado" });
  // as larguras anteriores já criaram um atendimento neste horário: o aviso aparece da segunda execução em diante
  const sucesso = page.getByRole("heading", { name: "Agendamento realizado!" });
  await expect(dialog.or(sucesso)).toBeVisible();
  if (await dialog.isVisible()) {
    const box = await dialog.boundingBox();
    const vw = page.viewportSize()!.width;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
    for (const b of await dialog.getByRole("button").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await dialog.getByRole("button", { name: "Agendar mesmo assim" }).click();
  }
  await expect(page.getByRole("heading", { name: "Agendamento realizado!" })).toBeVisible();
  await expectLayoutOk(page);

  expect(errors, `erros no console: ${errors.join(" | ")}`).toEqual([]);
});
