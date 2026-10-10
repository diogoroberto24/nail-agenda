import { expect, test } from "@playwright/test";
import { expectLayoutOk } from "./measure";
import { MARK, readFixture } from "./helpers";

/**
 * Etapas do novo agendamento nas larguras 320, 360, 390, 430, tablet e desktop (as mesmas do layout.spec):
 * sem rolagem horizontal, alvos de toque de 44 px, barra e botão sem cobrir o conteúdo, sem erros no console.
 * Cada etapa é alcançada pelo caminho real (tocando), porque o rascunho só existe dentro do fluxo.
 */
test("Etapa 1 (Cliente) e etapa 2 (Serviço)", async ({ page }) => {
  const fx = readFixture();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto("/agendamentos/novo");
  await expect(page).toHaveURL(/\/novo\/cliente$/);
  await expect(page.getByRole("heading", { level: 2, name: "1. Cliente" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expectLayoutOk(page);

  // com a busca em uso
  await page.getByLabel("Buscar cliente por nome ou telefone").filter({ visible: true }).fill(`${MARK} Maria`);
  await expect(page.getByRole("heading", { name: /Resultados da busca/ })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(fx.clientName) })).toBeVisible();
  await expectLayoutOk(page);

  // cadastro rápido aberto
  await page.getByRole("button", { name: "Limpar busca" }).click();
  await page.getByRole("button", { name: "Cadastrar nova cliente" }).click();
  await expect(page.getByRole("button", { name: "Cadastrar e escolher" })).toBeVisible();
  await expectLayoutOk(page);
  await page.getByRole("button", { name: "Cancelar cadastro" }).click();

  // com a cliente escolhida e o botão "Continuar" ativo
  await page.getByRole("button", { name: new RegExp(fx.clientName) }).first().click();
  await expect(page.getByRole("button", { name: /Continuar/ })).toBeEnabled();
  await expectLayoutOk(page);

  // etapa 2, sem serviço escolhido e depois com ele escolhido
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page).toHaveURL(/\/novo\/servico$/);
  await expect(page.getByRole("heading", { level: 2, name: "2. Serviço" })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`${MARK} Esmaltação`) })).toBeVisible();
  await expectLayoutOk(page);
  await page.getByRole("button", { name: new RegExp(`${MARK} Esmaltação`) }).click();
  await expect(page.getByRole("button", { name: /Continuar/ })).toBeEnabled();
  await expectLayoutOk(page);

  expect(errors, `erros no console: ${errors.join(" | ")}`).toEqual([]);
});

test("Etapa 3 (Data e horário)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const fx = readFixture();

  await page.goto("/agendamentos/novo");
  await page.getByRole("button", { name: new RegExp(fx.clientName) }).first().click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("button", { name: new RegExp(`${MARK} Esmaltação`) }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "3. Data e horário" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expectLayoutOk(page); // com hoje escolhido, antes de escolher o horário

  await page.getByRole("button", { name: "Próxima semana" }).click();
  await page.getByRole("group", { name: "Dias da semana" }).getByRole("button").first().click();
  await expect(page.getByRole("group", { name: "Horários" }).getByRole("button")).toHaveCount(24);
  await expectLayoutOk(page); // com a grade de horários

  await page.getByRole("button", { name: "14:00", exact: true }).click();
  await expect(page.getByRole("button", { name: /Continuar/ })).toBeEnabled();
  await expectLayoutOk(page); // com horário escolhido

  expect(errors, `erros no console: ${errors.join(" | ")}`).toEqual([]);
});
