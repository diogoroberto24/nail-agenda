import { expect, test, type Page } from "@playwright/test";
import { MARK, readFixture } from "./helpers";

/** Etapa 4 (Detalhes), aviso de horário ocupado e tela de sucesso do novo agendamento, no celular (390 × 844). */
test.describe.configure({ mode: "serial" });

const lbl = (page: Page, text: string | RegExp) => page.getByLabel(text).filter({ visible: true });
const continuar = (page: Page) => page.getByRole("button", { name: /Continuar/ });
const agendar = (page: Page) => page.getByRole("button", { name: "Agendar", exact: true });

/** Vai até a tela de detalhes pelo caminho real, num dia distante para não esbarrar em outros testes. */
async function goToDetails(page: Page, day: string, time: string) {
  const fx = readFixture();
  await page.goto(`/agendamentos/novo?data=${day}&hora=${time}`);
  await page.getByRole("button", { name: new RegExp(fx.clientName) }).first().click();
  await continuar(page).click();
  await page.getByRole("button", { name: new RegExp(`${MARK} Esmaltação`) }).click();
  await continuar(page).click();
  await expect(page.getByRole("button", { name: time, pressed: true })).toBeVisible();
  await continuar(page).click();
  await expect(page.getByRole("heading", { level: 2, name: "4. Detalhes adicionais" })).toBeVisible();
}

test("o resumo leva às etapas para editar (menos a Profissional) e volta ao resumo", async ({ page }) => {
  const fx = readFixture();
  await goToDetails(page, "2031-12-01", "08:00");

  const resumo = page.getByRole("region", { name: "Resumo" });
  await expect(resumo.getByRole("link")).toHaveCount(3);
  await expect(resumo).toContainText(fx.proA.name); // Profissional aparece, sem link
  await expect(resumo.getByRole("link", { name: new RegExp(fx.proA.name) })).toHaveCount(0);
  await expect(resumo.getByRole("link", { name: /Data e horário/ })).toHaveAttribute("href", "/agendamentos/novo/horario?retorno=detalhes");

  await resumo.getByRole("link", { name: /^Cliente/ }).click();
  await expect(page).toHaveURL(/\/novo\/cliente\?retorno=detalhes$/);
  await expect(page.getByRole("button", { name: new RegExp(fx.clientName), pressed: true })).toBeVisible();
  await continuar(page).click();
  await expect(page).toHaveURL(/\/novo\/detalhes$/); // voltou direto ao resumo
});

test("duração e preço são validados; observações têm limite de 200 caracteres", async ({ page }) => {
  await goToDetails(page, "2031-12-02", "08:00");
  await lbl(page, /Duração \(min\)/).fill("abc");
  await agendar(page).click();
  await expect(page.getByText("Use só números, ex.: 40.")).toBeVisible();
  await expect(page).toHaveURL(/\/novo\/detalhes$/);

  await lbl(page, /Duração \(min\)/).fill("40");
  await lbl(page, /Preço \(R\$\)/).fill("");
  await agendar(page).click();
  await expect(page.getByText("Informe o preço.")).toBeVisible();

  await lbl(page, /^Observações/).fill("x".repeat(250));
  await expect(lbl(page, /^Observações/)).toHaveValue("x".repeat(200));
  await expect(page.getByText("200/200")).toBeVisible();
});

test("agendar leva à tela de sucesso, com WhatsApp, 'Ver na agenda' e 'Novo agendamento'", async ({ page }) => {
  const fx = readFixture();
  await goToDetails(page, "2031-12-03", "09:00");
  await lbl(page, /^Observações/).fill("Trazer referência");
  await agendar(page).click();

  await expect(page).toHaveURL(/\/novo\/sucesso$/);
  await expect(page.getByRole("heading", { level: 1, name: "Agendamento realizado!" })).toBeVisible();
  const resumo = page.getByRole("region", { name: "Resumo do agendamento" });
  await expect(resumo).toContainText(fx.clientName);
  await expect(resumo).toContainText(`${MARK} Esmaltação`);
  await expect(resumo).toContainText(fx.proA.name);

  const wa = page.getByRole("link", { name: "Enviar confirmação no WhatsApp" });
  await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/55\d{10,11}\?text=/);
  await expect(wa).toHaveAttribute("href", /09%3A00/); // o horário vai na mensagem

  await expect(page.getByRole("link", { name: "Ver na agenda" })).toHaveAttribute("href", /\/agenda\?data=2031-12-03&destaque=/);
  await page.getByRole("link", { name: "Novo agendamento" }).click();
  await expect(page).toHaveURL(/\/novo\/cliente$/);
  await expect(page.getByRole("button", { pressed: true })).toHaveCount(0);
});

test("recarregar a tela de sucesso não mostra nada antigo: volta para a agenda", async ({ page }) => {
  await goToDetails(page, "2031-12-04", "09:00");
  await agendar(page).click();
  await expect(page).toHaveURL(/\/novo\/sucesso$/);
  await page.reload();
  await expect(page).toHaveURL(/\/agenda/);
});

test("horário ocupado: o aviso oferece escolher outro horário, voltar ou agendar mesmo assim", async ({ page }) => {
  await goToDetails(page, "2031-12-05", "10:00");
  await agendar(page).click();
  await expect(page).toHaveURL(/\/novo\/sucesso$/);

  await goToDetails(page, "2031-12-05", "10:00");
  await agendar(page).click();
  const dialog = page.getByRole("dialog", { name: "Horário ocupado" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/10:00 às /);
  await expect(page).toHaveURL(/\/novo\/detalhes$/); // nada foi salvo ainda

  await dialog.getByRole("button", { name: "Escolher outro horário" }).click();
  await expect(page).toHaveURL(/\/novo\/horario\?retorno=detalhes$/);
  await expect(page.getByRole("button", { name: "10:00, ocupado" })).toBeVisible();
  await page.getByRole("button", { name: "11:00", exact: true }).click();
  await continuar(page).click();
  await expect(page).toHaveURL(/\/novo\/detalhes$/);

  await agendar(page).click();
  await expect(page).toHaveURL(/\/novo\/sucesso$/); // 11:00 está livre: sem aviso
});
