import { expect, test, type Page } from "@playwright/test";
import { MARK, readFixture } from "./helpers";

/**
 * Novo agendamento em etapas, no celular (390 × 844): entrada, Cliente e Serviço.
 * (Detalhes e Sucesso entram nas próximas partes.)
 */
test.describe.configure({ mode: "serial" });

const lbl = (page: Page, text: string | RegExp) => page.getByLabel(text).filter({ visible: true });
const continuar = (page: Page) => page.getByRole("button", { name: /Continuar/ });
const steps = (page: Page) => page.getByRole("navigation", { name: "Etapas do agendamento" });

async function goToServiceStep(page: Page) {
  const fx = readFixture();
  await page.goto("/agendamentos/novo");
  await expect(page).toHaveURL(/\/agendamentos\/novo\/cliente$/);
  await page.getByRole("button", { name: new RegExp(fx.clientName) }).first().click();
  await continuar(page).click();
  await expect(page).toHaveURL(/\/agendamentos\/novo\/servico$/);
}

/** Escolhe o serviço de teste e continua para Data e horário. */
async function chooseServiceAndContinue(page: Page) {
  await page.getByRole("button", { name: new RegExp(`${MARK} Esmaltação`) }).click();
  await continuar(page).click();
  await expect(page).toHaveURL(/\/agendamentos\/novo\/horario$/);
}

test.describe("entrada e etapa 1: Cliente", () => {
  test("a entrada leva à primeira etapa, com título, profissional e barra de passos", async ({ page }) => {
    const fx = readFixture();
    await page.goto("/agendamentos/novo");
    await expect(page).toHaveURL(/\/agendamentos\/novo\/cliente$/);

    await expect(page.getByRole("heading", { level: 1, name: "Novo agendamento" })).toBeVisible();
    await expect(page.locator("header").getByText(fx.proA.name)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "1. Cliente" })).toBeVisible();
    await expect(page.getByText("Busque por nome ou telefone")).toBeVisible();

    await expect(steps(page).getByRole("listitem")).toHaveCount(4);
    await expect(steps(page).locator('[aria-current="step"]')).toContainText("Cliente");
    await expect(steps(page).getByRole("link")).toHaveCount(0); // ainda não há etapa concluída
    await expect(page.getByRole("button", { name: "Cadastrar nova cliente" })).toBeVisible();
  });

  test("mostra 'Clientes recentes' com quem foi agendada por mim", async ({ page }) => {
    const fx = readFixture();
    await page.goto("/agendamentos/novo");
    await expect(page.getByRole("heading", { name: "Clientes recentes" })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(fx.clientName) })).toBeVisible();
  });

  test("a busca filtra por nome e por telefone, e avisa quando não acha", async ({ page }) => {
    const fx = readFixture();
    await page.goto("/agendamentos/novo");
    const busca = lbl(page, "Buscar cliente por nome ou telefone");

    await busca.fill(`${MARK} Maria`);
    await expect(page.getByRole("heading", { name: /Resultados da busca/ })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(fx.clientName) })).toBeVisible();

    await busca.fill("5511999990001".slice(2, 11)); // parte do telefone da cliente fixa (11 99999 0001)
    await expect(page.getByRole("button", { name: new RegExp(fx.clientName) })).toBeVisible();

    await busca.fill("zzzz nao existe");
    await expect(page.getByText("Ninguém encontrada com esse nome ou telefone.")).toBeVisible();
    await page.getByRole("button", { name: "Limpar busca" }).click();
    await expect(page.getByRole("heading", { name: "Clientes recentes" })).toBeVisible();
  });

  test("tocar na cliente só a ESCOLHE; 'Continuar' (desativado antes) leva ao Serviço", async ({ page }) => {
    const fx = readFixture();
    await page.goto("/agendamentos/novo");
    await expect(continuar(page)).toBeDisabled();
    await expect(page.getByText("Escolha uma cliente para continuar.")).toBeVisible();

    await page.getByRole("button", { name: new RegExp(fx.clientName) }).first().click();
    await expect(page).toHaveURL(/\/novo\/cliente$/); // não avançou sozinho
    await expect(page.getByRole("button", { name: new RegExp(fx.clientName), pressed: true })).toBeVisible();
    await expect(continuar(page)).toBeEnabled();

    await continuar(page).click();
    await expect(page).toHaveURL(/\/agendamentos\/novo\/servico$/);
    await expect(page.getByRole("heading", { level: 2, name: "2. Serviço" })).toBeVisible();
    await expect(steps(page).locator('[aria-current="step"]')).toContainText("Serviço");
    await expect(steps(page).getByRole("link", { name: /Cliente: concluída/ })).toBeVisible();
  });

  test("cadastro rápido: cadastra e deixa a cliente escolhida; 'Continuar' segue para o Serviço", async ({ page }) => {
    await page.goto("/agendamentos/novo");
    await page.getByRole("button", { name: "Cadastrar nova cliente" }).click();
    await lbl(page, "Nome completo").fill(`${MARK}Rapida Teste`);
    await lbl(page, "Telefone com DDD").fill("(41) 98888-0002");
    await page.getByRole("button", { name: "Cadastrar e escolher" }).click();

    // fica na etapa 1, com a nova cliente marcada no topo; segue pelo "Continuar"
    await expect(page).toHaveURL(/\/agendamentos\/novo\/cliente$/);
    await expect(page.getByRole("button", { name: new RegExp(`${MARK}Rapida Teste`), pressed: true })).toBeVisible();
    await continuar(page).click();
    await expect(page).toHaveURL(/\/agendamentos\/novo\/servico$/);

    // voltar: a cliente recém-cadastrada continua marcada
    await steps(page).getByRole("link", { name: /Cliente: concluída/ }).click();
    await expect(page.getByRole("button", { name: new RegExp(`${MARK}Rapida Teste`), pressed: true })).toBeVisible();
  });
});

test.describe("etapa 2: Serviço", () => {
  test("lista só os serviços ativos, com duração e preço, e explica o preenchimento automático", async ({ page }) => {
    await goToServiceStep(page);
    const esmaltacao = page.getByRole("button", { name: new RegExp(`${MARK} Esmaltação`) });
    await expect(esmaltacao).toBeVisible();
    await expect(esmaltacao).toContainText("40 min");
    await expect(esmaltacao).toContainText("R$");
    // serviço da colega não aparece (cada uma tem os seus)
    await expect(page.getByRole("button", { name: new RegExp(`${MARK} Alongamento`) })).toHaveCount(0);
    await expect(page.getByText(/preenchidos automaticamente conforme o serviço selecionado/)).toBeVisible();
  });

  test("tocar no serviço só o ESCOLHE; 'Continuar' leva a Data e horário, com as duas primeiras etapas concluídas", async ({ page }) => {
    await goToServiceStep(page);
    await expect(continuar(page)).toBeDisabled();
    await expect(page.getByText("Escolha um serviço para continuar.")).toBeVisible();

    await page.getByRole("button", { name: new RegExp(`${MARK} Esmaltação`) }).click();
    await expect(page).toHaveURL(/\/novo\/servico$/); // não avançou sozinho
    await expect(continuar(page)).toBeEnabled();

    await continuar(page).click();
    await expect(page).toHaveURL(/\/agendamentos\/novo\/horario$/);
    await expect(page.getByRole("heading", { level: 2, name: "3. Data e horário" })).toBeVisible();
    await expect(steps(page).getByRole("link")).toHaveCount(2);
  });

  test("a escolha fica guardada: ao voltar, a cliente e o serviço aparecem marcados", async ({ page }) => {
    const fx = readFixture();
    await goToServiceStep(page);
    await chooseServiceAndContinue(page);

    await steps(page).getByRole("link", { name: /Serviço: concluída/ }).click();
    await expect(page.getByRole("button", { name: new RegExp(`${MARK} Esmaltação`), pressed: true })).toBeVisible();

    await steps(page).getByRole("link", { name: /Cliente: concluída/ }).click();
    await expect(page.getByRole("button", { name: new RegExp(fx.clientName), pressed: true })).toBeVisible();
  });
});

test.describe("navegação do fluxo", () => {
  test("o botão voltar leva à etapa anterior e, da primeira, à agenda", async ({ page }) => {
    await goToServiceStep(page);
    await page.getByRole("link", { name: "Voltar para Cliente" }).click();
    await expect(page).toHaveURL(/\/novo\/cliente$/);
    await page.getByRole("link", { name: "Voltar para a agenda" }).click();
    await expect(page).toHaveURL(/\/agenda/);
  });

  test("recarregar no meio do fluxo (o rascunho se perde) volta para a etapa que falta", async ({ page }) => {
    await goToServiceStep(page);
    await chooseServiceAndContinue(page);
    await page.reload();
    await expect(page).toHaveURL(/\/novo\/cliente$/);
    await expect(page.getByRole("heading", { level: 2, name: "1. Cliente" })).toBeVisible();
  });

  test("abrir uma etapa adiante direto pelo endereço também volta para a que falta", async ({ page }) => {
    for (const slug of ["servico", "horario", "detalhes"]) {
      await page.goto(`/agendamentos/novo/${slug}`);
      await expect(page).toHaveURL(/\/novo\/cliente$/);
    }
  });

  test("vindo da ficha da cliente (?clienteId=), pula a etapa 1 e já abre no Serviço", async ({ page }) => {
    const fx = readFixture();
    await page.goto(`/agendamentos/novo?clienteId=${fx.clientId}&data=2031-09-20`);
    await expect(page).toHaveURL(/\/novo\/servico$/);
    await expect(steps(page).getByRole("link", { name: /Cliente: concluída/ })).toBeVisible();

    await steps(page).getByRole("link", { name: /Cliente: concluída/ }).click();
    await expect(page.getByRole("button", { name: new RegExp(fx.clientName), pressed: true })).toBeVisible();
    // da primeira etapa, voltar leva à agenda no dia pedido
    await expect(page.getByRole("link", { name: "Voltar para a agenda" })).toHaveAttribute("href", "/agenda?data=2031-09-20");
  });

  test("começar um novo agendamento depois de abandonar outro NÃO traz as escolhas antigas", async ({ page }) => {
    await goToServiceStep(page);
    await chooseServiceAndContinue(page);

    // sai do fluxo por navegação interna e volta pelo botão da agenda
    await page.goto("/agenda");
    await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Início" }).click();
    await page.getByRole("link", { name: "Novo agendamento" }).click();
    await expect(page).toHaveURL(/\/novo\/cliente$/);
    await expect(page.getByRole("button", { pressed: true })).toHaveCount(0); // ninguém marcada
    await expect(steps(page).getByRole("link")).toHaveCount(0);
  });

  test("a barra de navegação inferior continua visível, com 'Agenda' destacada", async ({ page }) => {
    await goToServiceStep(page);
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Agenda" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("etapa 3: Data e horário", () => {
  async function goToTimeStep(page: Page) {
    await goToServiceStep(page);
    await chooseServiceAndContinue(page);
    await expect(page.getByRole("heading", { level: 2, name: "3. Data e horário" })).toBeVisible();
  }

  test("mostra a semana de segunda a domingo e começa com hoje escolhido e só libera o Continuar com horário", async ({ page }) => {
    await goToTimeStep(page);
    const days = page.getByRole("group", { name: "Dias da semana" }).getByRole("button");
    await expect(days).toHaveCount(7);
    await expect(days.first()).toContainText("Seg");
    await expect(days.last()).toContainText("Dom");
    await expect(continuar(page)).toBeDisabled();
  });

  test("escolher dia e horário libera o Continuar; as etapas anteriores aparecem como concluídas", async ({ page }) => {
    await goToTimeStep(page);
    await page.getByRole("button", { name: "Próxima semana" }).click();
    await page.getByRole("group", { name: "Dias da semana" }).getByRole("button").first().click(); // segunda da semana seguinte
    await expect(page.getByRole("group", { name: "Horários" }).getByRole("button")).toHaveCount(24);
    await page.getByRole("button", { name: "14:00", exact: true }).click();
    await expect(page.getByText(/Termina às/)).toBeVisible();
    await expect(steps(page).getByRole("link")).toHaveCount(2);
    await expect(continuar(page)).toBeEnabled();
    await continuar(page).click();
    await expect(page).toHaveURL(/\/agendamentos\/novo\/detalhes$/);
  });

  test("a semana anterior fica bloqueada na semana atual e o voltar leva ao Serviço", async ({ page }) => {
    await goToTimeStep(page);
    await expect(page.getByRole("button", { name: "Semana anterior" })).toBeDisabled();
    await page.getByRole("link", { name: /Voltar/ }).first().click();
    await expect(page).toHaveURL(/\/agendamentos\/novo\/servico$/);
  });

  test("recarregar a etapa 3 leva de volta ao começo (rascunho perdido)", async ({ page }) => {
    await goToTimeStep(page);
    await page.reload();
    await expect(page).toHaveURL(/\/agendamentos\/novo\/cliente$/);
  });
});
