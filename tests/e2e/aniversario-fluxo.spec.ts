import { expect, test, type Page } from "@playwright/test";
import { MARK, readFixture } from "./helpers";

/**
 * Aniversário da cliente no celular (390 × 844): campo no cadastro, ficha e "Aniversariantes de hoje" no Início.
 * Exige a migração 20261011000001 aplicada no Supabase.
 */
test.describe.configure({ mode: "serial" });

const lbl = (page: Page, text: string | RegExp) => page.getByLabel(text).filter({ visible: true });

/** "dd/mm" da data de hoje do salão (a fixture traz YYYY-MM-DD). */
function todayDdMm() {
  const [, m, d] = readFixture().today.split("-");
  return `${d}/${m}`;
}

async function createClientWithBirthday(page: Page, name: string, phone: string, birthday: string) {
  await page.goto("/clientes/novo");
  await lbl(page, /Nome completo/).fill(name);
  await lbl(page, /Telefone com DDD/).fill(phone);
  if (birthday) await lbl(page, /Aniversário/).fill(birthday);
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]+\?salvo=1/);
}

test("cadastro: o campo Aniversário é opcional e a ficha mostra a data", async ({ page }) => {
  await createClientWithBirthday(page, `${MARK}Sem Aniversario`, "(11) 98888-7001", "");
  await expect(page.getByText(/Aniversário:/)).toHaveCount(0);

  await createClientWithBirthday(page, `${MARK}Com Aniversario`, "(11) 98888-7002", "5/3");
  await expect(page.getByText("Aniversário: 05/03")).toBeVisible();
});

test("a data pode ter ano, é validada e pode ser editada ou apagada", async ({ page }) => {
  await createClientWithBirthday(page, `${MARK}Aniversario Ano`, "(11) 98888-7003", "15/03/1990");
  await expect(page.getByText("Aniversário: 15/03/1990")).toBeVisible();

  await page.getByRole("link", { name: "Editar" }).click();
  await expect(lbl(page, /Aniversário/)).toHaveValue("15/03/1990");
  await lbl(page, /Aniversário/).fill("31/02");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText(/Data inválida\. Use dia\/mês/)).toBeVisible();
  await expect(page).toHaveURL(/\/editar$/);

  await lbl(page, /Aniversário/).fill("20/4");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Aniversário: 20/04")).toBeVisible();

  await page.getByRole("link", { name: "Editar" }).click();
  await lbl(page, /Aniversário/).fill("");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText(/Aniversário:/)).toHaveCount(0);
});

test("Início: aniversariante de hoje aparece com o botão de parabéns no WhatsApp; arquivada e outro dia não", async ({ page }) => {
  const hoje = todayDdMm();
  await createClientWithBirthday(page, `${MARK}Parabens Hoje`, "(11) 98888-7004", `${hoje}/1991`);
  await createClientWithBirthday(page, `${MARK}Outro Dia`, "(11) 98888-7005", "01/01");

  await page.goto("/");
  const secao = page.getByRole("region", { name: "Aniversariantes de hoje" });
  await expect(secao).toBeVisible();
  const linha = secao.locator("li").filter({ hasText: `${MARK}Parabens Hoje` });
  await expect(linha).toBeVisible();
  await expect(linha).toContainText(/faz \d+ anos/);
  await expect(secao.locator("li").filter({ hasText: `${MARK}Outro Dia` })).toHaveCount(0);

  const wa = linha.getByRole("link", { name: "Enviar parabéns" });
  await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/5511988887004\?text=/);
  const texto = decodeURIComponent((await wa.getAttribute("href"))!.split("?text=")[1]);
  expect(texto).toContain("feliz aniversário");
  expect(texto).toMatch(/^Olá /);

  // arquivar tira da lista
  await page.goto("/clientes?q=Parabens");
  await page.getByRole("link", { name: new RegExp(`${MARK}Parabens Hoje`) }).first().click();
  await page.getByRole("button", { name: "Arquivar cliente" }).click();
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await expect(page.getByText("Cliente arquivada.")).toBeVisible();
  await page.goto("/");
  await expect(page.locator("li").filter({ hasText: `${MARK}Parabens Hoje` })).toHaveCount(0);
});
