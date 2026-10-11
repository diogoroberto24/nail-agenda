import { expect, test, type Page } from "@playwright/test";
import { MARK, readFixture } from "./helpers";

/**
 * Recorrência no celular (390 × 844): criar (com conferência das datas e conflitos), ver na ficha, na lista, na agenda
 * e no detalhe do atendimento, alterar a partir de uma data e encerrar. Exige a migração 20261012000001 aplicada.
 * Usa as datas reais (a partir de amanhã); tudo que cria é apagado no final (global-teardown).
 */
test.describe.configure({ mode: "serial" });

const lbl = (page: Page, text: string | RegExp) => page.getByLabel(text).filter({ visible: true });
const SERVICE = new RegExp(`${MARK} Esmaltação`);

async function openNewRecurrence(page: Page) {
  const fx = readFixture();
  await page.goto(`/clientes/${fx.clientId}`);
  await page.getByRole("link", { name: "Nova recorrência" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Nova recorrência" })).toBeVisible();
  return fx;
}

async function fillRule(page: Page, date: string, time: string) {
  await page.getByRole("radio", { name: SERVICE }).click();
  await lbl(page, "Primeiro atendimento").fill(date);
  await lbl(page, "Horário").fill(time);
}

test("a ficha explica a recorrência e a lista de clientes ainda não marca a cliente", async ({ page }) => {
  const fx = readFixture();
  await page.goto(`/clientes/${fx.clientId}`);
  await expect(page.getByRole("heading", { name: "Recorrência" })).toBeVisible();
  await expect(page.getByText(/sempre no mesmo dia e horário/)).toBeVisible();
  await page.goto("/clientes");
  await expect(page.locator("li").filter({ hasText: fx.clientName }).getByText("Recorrente")).toHaveCount(0);
});

test("o formulário valida antes de consultar as datas", async ({ page }) => {
  await openNewRecurrence(page);
  await page.getByRole("button", { name: "Ver as datas" }).click();
  await expect(page.getByText("Escolha o serviço.")).toBeVisible();
  await expect(page.getByText("Informe a data do primeiro atendimento.")).toBeVisible();

  await page.getByRole("radio", { name: "A cada X dias" }).click();
  await expect(lbl(page, "De quantos em quantos dias")).toBeVisible();
  await page.getByRole("radio", { name: "Semanal" }).click();
  await expect(lbl(page, "De quantos em quantos dias")).toHaveCount(0);
});

test("criar semanal: confere as datas, cria e aparece na ficha, na lista, na agenda e no detalhe", async ({ page }) => {
  const fx = await openNewRecurrence(page);
  await fillRule(page, fx.tomorrow, "07:00");
  expect(await lbl(page, /Duração \(min\)/).inputValue()).toBe("40"); // padrão do serviço
  await page.getByRole("button", { name: "Ver as datas" }).click();

  await expect(page.getByRole("heading", { name: /^Toda|^Todo/ })).toBeVisible();
  const datas = page.getByRole("checkbox");
  const total = await datas.count();
  expect(total).toBeGreaterThanOrEqual(26);
  expect(total).toBeLessThanOrEqual(27);
  await expect(page.getByText(/atendimentos serão criados/)).toBeVisible();
  await expect(page.getByText("Você já tem atendimento neste horário")).toHaveCount(0);

  await page.getByRole("button", { name: new RegExp(`^Criar ${total} atendimentos$`) }).click();
  await expect(page).toHaveURL(new RegExp(`/clientes/${fx.clientId}\\?recorrencia=criada`));
  await expect(page.getByText(new RegExp(`Recorrência criada: ${total} atendimentos reservados`))).toBeVisible();
  const secao = page.getByRole("region", { name: "Recorrência" }).or(page.locator("section").filter({ has: page.getByRole("heading", { name: "Recorrência" }) }));
  await expect(secao.getByRole("link", { name: /às 07:00/ })).toBeVisible();

  // o histórico da cliente não fica lotado com os próximos 6 meses
  const historico = page.locator("section").filter({ has: page.getByRole("heading", { name: "Histórico" }) });
  await expect(historico.locator("li").filter({ hasText: "07:00" })).toHaveCount(0);

  await page.goto("/clientes");
  await expect(page.locator("li").filter({ hasText: fx.clientName }).getByText("Recorrente")).toBeVisible();

  await page.goto(`/agenda?data=${fx.tomorrow}`);
  const card = page.locator("li").filter({ hasText: "07:00" }).filter({ has: page.locator("a[href^='/agendamentos/']") });
  await expect(card).toBeVisible();
  await expect(card.getByText("Recorrente")).toBeVisible();
  await expect(card).toContainText("Aguardando confirmação");

  await card.locator("a[href^='/agendamentos/']").first().click();
  await page.getByRole("link", { name: "Ver recorrência" }).click();
  await expect(page).toHaveURL(/\/recorrencias\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Recorrência" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Próximos atendimentos" })).toBeVisible();
  expect(await page.locator("section ul li").count()).toBeGreaterThanOrEqual(26);
});

test("conflito: a data que já tem atendimento vem pulada e avisada; dá para criar mesmo assim", async ({ page }) => {
  const fx = await openNewRecurrence(page);
  await fillRule(page, fx.tomorrow, "09:00"); // amanhã às 09:00 já existe um atendimento confirmado
  await page.getByRole("button", { name: "Ver as datas" }).click();

  await expect(page.getByText("Você já tem atendimento neste horário").first()).toBeVisible();
  const primeira = page.getByRole("checkbox").first();
  await expect(primeira).toBeChecked(); // conflito vem pulado
  await expect(page.getByText(/1 data pulada/)).toBeVisible();
  await primeira.uncheck(); // criar mesmo assim
  await expect(page.getByText(/datas? puladas?/)).toHaveCount(0);

  await page.getByRole("button", { name: "Voltar e editar" }).click();
  await expect(lbl(page, "Horário")).toHaveValue("09:00"); // o que foi digitado continua
});

test("alterar a partir de uma data: mostra o aviso, confere e troca o horário dali em diante", async ({ page }) => {
  const fx = readFixture();
  await page.goto(`/clientes/${fx.clientId}`);
  await page.getByRole("link", { name: /às 07:00/ }).click();
  await page.getByRole("link", { name: "Alterar a partir de uma data" }).click();
  await expect(page.getByText(/termina na véspera da data escolhida/)).toBeVisible();
  await expect(lbl(page, "Horário")).toHaveValue("07:00");
  await lbl(page, "Horário").fill("07:30");
  await page.getByRole("button", { name: "Ver as datas" }).click();
  await expect(page.getByText("Você já tem atendimento neste horário")).toHaveCount(0); // a série atual não conflita com a nova
  await page.getByRole("button", { name: /^Alterar e criar \d+$/ }).click();

  await expect(page).toHaveURL(new RegExp(`/clientes/${fx.clientId}\\?recorrencia=alterada`));
  await expect(page.getByText(/Recorrência alterada: \d+ novos atendimentos criados/)).toBeVisible();
  await expect(page.getByRole("link", { name: /às 07:30/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /às 07:00/ })).toHaveCount(0);
});

test("encerrar pede confirmação, cancela os futuros e a recorrência some da ficha", async ({ page }) => {
  const fx = readFixture();
  await page.goto(`/clientes/${fx.clientId}`);
  await page.getByRole("link", { name: /às 07:30/ }).click();
  await page.getByRole("button", { name: "Encerrar recorrência" }).click();
  await expect(page.getByRole("alertdialog", { name: "Confirmar encerramento" })).toBeVisible();
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page.getByRole("button", { name: "Encerrar recorrência" })).toBeVisible();

  await page.getByRole("button", { name: "Encerrar recorrência" }).click();
  await page.getByRole("button", { name: "Encerrar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/clientes/${fx.clientId}\\?recorrencia=encerrada`));
  await expect(page.getByText(/Recorrência encerrada: \d+ atendimentos cancelados/)).toBeVisible();
  await expect(page.getByRole("link", { name: /às 07:30/ })).toHaveCount(0);

  await page.goto("/clientes");
  await expect(page.locator("li").filter({ hasText: fx.clientName }).getByText("Recorrente")).toHaveCount(0);
  await page.goto(`/agenda?data=${fx.tomorrow}`);
  await expect(page.locator("li").filter({ hasText: "07:30" }).filter({ has: page.locator("a[href^='/agendamentos/']") })).toHaveCount(0);
});

test("a colega não consegue abrir a recorrência de outra profissional pelo endereço", async ({ page }) => {
  await page.goto("/recorrencias/00000000-0000-4000-8000-000000000000");
  await expect(page.getByText(/não encontrad|404|could not be found/i).first()).toBeVisible();
});
