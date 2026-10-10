import { expect, test, type Page } from "@playwright/test";
import { MARK, createSessionState, loadEnv, readFixture } from "./helpers";

/**
 * Fluxo completo de uma profissional no celular (390 × 844), com toque e teclado virtual simulados:
 * cadastrar cliente (com telefone repetido), serviço, agendar (com conflito), confirmar, concluir,
 * reabrir, cancelar, remarcar, WhatsApp, navegar pela agenda, Início, Perfil, Configurações e Sair.
 * Os dados criados são marcados com __e2e__ e apagados no final (global-teardown).
 */
test.describe.configure({ mode: "serial" });

const DAY = "2031-09-15";
const CLIENT = `${MARK}Ana Teste`;
const CLIENT_DUP = `${MARK}Ana Duplicada`;
const SERVICE = `${MARK} Gel`;
const PHONE = "(11) 98888-0001";
const PHONE_DIGITS = "5511988880001";

/**
 * Campo pelo rótulo, só entre os VISÍVEIS. O Next mantém as telas já visitadas montadas e escondidas
 * (para preservar o estado), então um mesmo rótulo pode existir em duas telas; quem usa vê apenas a atual.
 */
const lbl = (page: Page, text: string | RegExp, opts?: { exact?: boolean }) => page.getByLabel(text, opts).filter({ visible: true });

/** Falha o teste se a página gerar erro de JavaScript. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return () => expect(errors, `erros no console: ${errors.join(" | ")}`).toEqual([]);
}

const card = (page: Page, text: string | RegExp) => page.locator("li").filter({ hasText: text }).filter({ has: page.locator("a[href^='/agendamentos/']") });

/**
 * Novo agendamento pelo passo a passo, até a tela de detalhes (resumo): cliente → serviço → data e horário.
 * Data e horário entram pelo link de entrada (?data=&hora=), como quando se toca num horário da agenda.
 */
async function bookUntilDetails(page: Page, client: string, day: string, time: string) {
  await page.goto(`/agendamentos/novo?data=${day}&hora=${time}`);
  await lbl(page, "Buscar cliente por nome ou telefone").fill(client);
  await page.getByRole("button", { name: new RegExp(client) }).first().click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("button", { name: new RegExp(SERVICE) }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.getByRole("button", { name: time, pressed: true })).toBeVisible();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "4. Detalhes adicionais" })).toBeVisible();
}

/** Toca em "Agendar" e, na tela de sucesso, em "Ver na agenda". */
async function saveAndOpenAgenda(page: Page) {
  await page.getByRole("button", { name: "Agendar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Agendamento realizado!" })).toBeVisible();
  await page.getByRole("link", { name: "Ver na agenda" }).click();
}

test.describe("cadastros", () => {
  test("cadastrar cliente: telefone é formatado e a ficha abre com aviso de salvo", async ({ page }) => {
    const check = watchErrors(page);
    await page.goto("/clientes/novo");
    await lbl(page, "Nome completo").fill(CLIENT);
    await lbl(page, "Telefone com DDD").fill("11988880001");
    await lbl(page, "Observações").fill("alérgica a acetona");
    await page.getByRole("button", { name: "Cadastrar cliente" }).click();

    await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}\?salvo=1/);
    await expect(page.getByText("Cadastro salvo.")).toBeVisible();
    await expect(page.getByRole("heading", { name: CLIENT })).toBeVisible();
    await expect(page.getByText(PHONE)).toBeVisible();
    await expect(page.getByText("alérgica a acetona")).toBeVisible();
    await expect(page.getByText("Nenhum atendimento ainda.")).toBeVisible();
    check();
  });

  test("telefone repetido: avisa, oferece abrir o cadastro existente e só salva se confirmar", async ({ page }) => {
    await page.goto("/clientes/novo");
    await lbl(page, "Nome completo").fill(CLIENT_DUP);
    await lbl(page, "Telefone com DDD").fill("11988880001");
    await lbl(page, "Nome completo").click(); // sai do campo do telefone

    await expect(page.getByText("Este telefone já está cadastrado.")).toBeVisible();
    await expect(lbl(page, "Telefone com DDD")).toHaveValue(PHONE);
    await expect(page.getByRole("link", { name: `Abrir cadastro de ${CLIENT}` })).toBeVisible();

    await page.getByRole("button", { name: "Cadastrar mesmo assim" }).click();
    await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}\?salvo=1/);
    await expect(page.getByRole("heading", { name: CLIENT_DUP })).toBeVisible();
  });

  test("busca por nome e por telefone; sem resultado mostra aviso", async ({ page }) => {
    await page.goto("/clientes");
    const search = page.getByRole("searchbox", { name: "Buscar cliente por nome ou telefone" });

    const nameLink = (name: string) => page.getByRole("link", { name: new RegExp(name) });

    // por nome: o filtro precisa ser aplicado (a outra cliente some da lista)
    await search.fill(`${MARK}Ana Dup`);
    await expect(page).toHaveURL(/q=/);
    await expect(nameLink(CLIENT_DUP).first()).toBeVisible();
    await expect(nameLink(CLIENT)).toHaveCount(0);

    // por telefone (os dois cadastros têm o mesmo número)
    await search.fill("98888000");
    await expect(page).toHaveURL(/q=98888000/);
    await expect(nameLink(CLIENT).first()).toBeVisible();
    await expect(nameLink(CLIENT_DUP).first()).toBeVisible();

    await search.fill("zzzz nao existe");
    await expect(page).toHaveURL(/q=zzzz/);
    await expect(page.getByText("Ninguém encontrada")).toBeVisible();
  });

  test("arquivar pede confirmação, some da lista e pode ser reativada (histórico preservado)", async ({ page }) => {
    await page.goto(`/clientes?q=${encodeURIComponent(CLIENT_DUP)}`);
    await page.getByRole("link", { name: new RegExp(CLIENT_DUP) }).first().click();

    await page.getByRole("button", { name: "Arquivar cliente" }).click();
    await expect(page.getByText(/histórico de atendimentos é mantido/)).toBeVisible();
    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(page.getByRole("button", { name: "Arquivar cliente" })).toBeVisible();

    await page.getByRole("button", { name: "Arquivar cliente" }).click();
    await page.getByRole("button", { name: "Arquivar", exact: true }).click();
    await expect(page.getByText(/Cliente arquivada/)).toBeVisible();

    await page.goto(`/clientes?q=${encodeURIComponent(CLIENT_DUP)}`);
    await expect(page.getByText("Ninguém encontrada")).toBeVisible();
    await page.goto(`/clientes?q=${encodeURIComponent(CLIENT_DUP)}&arquivadas=1`);
    await page.getByRole("link", { name: new RegExp(CLIENT_DUP) }).first().click();
    await page.getByRole("button", { name: "Reativar cliente" }).click();
    await expect(page.getByRole("button", { name: "Arquivar cliente" })).toBeVisible();
  });

  test("serviço: cadastrar com duração rápida, editar preço, desativar e reativar", async ({ page }) => {
    const check = watchErrors(page);
    await page.goto("/servicos/novo");
    await lbl(page, "Nome do serviço").fill(SERVICE);
    await page.getByRole("button", { name: "45 min" }).click();
    await expect(lbl(page, /Duração padrão/)).toHaveValue("45");
    await lbl(page, /Preço padrão/).fill("70,50");
    await page.getByRole("button", { name: "Cadastrar serviço" }).click();

    await expect(page).toHaveURL(/\/servicos\?salvo=1/);
    await expect(page.getByText("Serviço salvo.")).toBeVisible();
    const row = page.locator("li").filter({ hasText: SERVICE });
    await expect(row).toContainText("45 min");
    await expect(row).toContainText("R$");

    await row.getByRole("link").first().click();
    await lbl(page, /Preço padrão/).fill("80");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.locator("li").filter({ hasText: SERVICE })).toContainText("80,00");

    await page.getByRole("button", { name: `Desativar ${SERVICE}` }).click();
    await expect(page.locator("li").filter({ hasText: SERVICE })).toContainText("Desativado");
    await page.getByRole("button", { name: `Reativar ${SERVICE}` }).click();
    await expect(page.locator("li").filter({ hasText: SERVICE })).not.toContainText("Desativado");
    check();
  });
});

test.describe("agendamento e status", () => {
  test("agendar: o resumo calcula o término, a tela de sucesso aparece e a agenda abre no dia com o atendimento em destaque", async ({ page }) => {
    const check = watchErrors(page);
    await bookUntilDetails(page, CLIENT, DAY, "10:00");

    const resumo = page.getByRole("region", { name: "Resumo" });
    await expect(resumo).toContainText(CLIENT);
    await expect(resumo).toContainText("10:00 – 10:45"); // 10:00 + 45 min (padrão do serviço)
    await page.getByRole("button", { name: "Agendar", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Agendamento realizado!" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Resumo do agendamento" })).toContainText(CLIENT);
    await page.getByRole("link", { name: "Ver na agenda" }).click();

    await expect(page).toHaveURL(new RegExp(`/agenda\\?data=${DAY}&destaque=`));
    await expect(page.getByText("Atendimento salvo.")).toBeVisible();
    const c = card(page, "10:00 – 10:45");
    await expect(c).toBeVisible();
    await expect(c).toContainText("Aguardando confirmação");
    await expect(c).toContainText(CLIENT);
    check();
  });

  test("a duração pode ser ajustada só neste atendimento (o serviço continua com 45 min)", async ({ page }) => {
    await bookUntilDetails(page, CLIENT, DAY, "14:00");
    await lbl(page, /Duração \(min\)/).fill("75");
    await expect(page.getByRole("region", { name: "Resumo" })).toContainText("14:00 – 15:15");
    await saveAndOpenAgenda(page);
    await expect(card(page, "14:00 – 15:15")).toBeVisible();

    await page.goto("/servicos");
    await expect(page.locator("li").filter({ hasText: SERVICE })).toContainText("45 min");
  });

  test("conflito de horário: o aviso aparece ao agendar e só segue com 'Agendar mesmo assim'", async ({ page }) => {
    await bookUntilDetails(page, CLIENT, DAY, "10:30");
    await page.getByRole("button", { name: "Agendar", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Horário ocupado" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/10:00 às 10:45/);
    // "Voltar" fecha o aviso sem salvar
    await dialog.getByRole("button", { name: "Voltar" }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: "Agendar", exact: true }).click();
    await page.getByRole("dialog", { name: "Horário ocupado" }).getByRole("button", { name: "Agendar mesmo assim" }).click();
    await expect(page.getByRole("heading", { name: "Agendamento realizado!" })).toBeVisible();
    await page.getByRole("link", { name: "Ver na agenda" }).click();

    await expect(page).toHaveURL(new RegExp(`/agenda\\?data=${DAY}`));
    await expect(card(page, "10:30 – 11:15")).toContainText("Horário sobreposto");
    await expect(card(page, "10:00 – 10:45")).toContainText("Horário sobreposto");
  });

  test("confirmar → concluir → reabrir, tudo por toque no cartão", async ({ page }) => {
    const check = watchErrors(page);
    await page.goto(`/agenda?data=${DAY}`);
    const c = () => card(page, "10:00 – 10:45");

    await c().getByRole("button", { name: "Confirmar" }).click();
    await expect(c()).toContainText("Confirmado");

    await c().getByRole("button", { name: "Concluir" }).click();
    await expect(c()).toContainText("Concluído");
    await expect(c().getByRole("button", { name: "Reabrir atendimento" })).toBeVisible();
    await expect(c().getByRole("link", { name: /Editar atendimento/ })).toHaveCount(0); // concluído não edita

    await c().getByRole("button", { name: "Reabrir atendimento" }).click();
    await expect(c()).toContainText("Confirmado");
    await expect(c().getByRole("button", { name: "Concluir" })).toBeVisible();
    check();
  });

  test("cancelar pede confirmação, libera o horário e tira o atendimento da agenda", async ({ page }) => {
    await page.goto(`/agenda?data=${DAY}`);
    const c = card(page, "10:30 – 11:15");

    await c.getByRole("button", { name: /Mais ações/ }).click();
    await c.getByRole("button", { name: "Cancelar agendamento" }).click();
    await expect(c.getByRole("alertdialog")).toContainText("O horário será liberado");
    await c.getByRole("button", { name: "Voltar" }).click();
    await expect(c).toBeVisible();

    await c.getByRole("button", { name: "Cancelar agendamento" }).click();
    await c.getByRole("button", { name: "Cancelar atendimento" }).click();

    await expect(page).toHaveURL(/cancelado=1/);
    await expect(page.getByText("Atendimento cancelado. O horário foi liberado.")).toBeVisible();
    await expect(card(page, "10:30 – 11:15")).toHaveCount(0);
    await expect(card(page, "10:00 – 10:45")).not.toContainText("Horário sobreposto");

    // o histórico da cliente guarda o cancelamento
    await page.goto("/clientes?q=" + encodeURIComponent(CLIENT));
    await page.getByRole("link", { name: new RegExp(CLIENT) }).first().click();
    await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
  });

  test("remarcar um atendimento confirmado volta para 'aguardando confirmação'", async ({ page }) => {
    await page.goto(`/agenda?data=${DAY}`);
    await card(page, "10:00 – 10:45").getByRole("link", { name: /Editar atendimento/ }).click();

    await expect(lbl(page, "Horário")).toHaveValue("10:00");
    await lbl(page, "Horário").fill("11:00");
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page.getByText(/voltou para Aguardando confirmação/)).toBeVisible();
    const c = card(page, "11:00 – 11:45");
    await expect(c).toContainText("Aguardando confirmação");
    await expect(card(page, "10:00 – 10:45")).toHaveCount(0);
  });

  test("WhatsApp: abre wa.me do telefone da cliente com a mensagem de confirmação preenchida", async ({ page }) => {
    const fx = readFixture();
    await page.goto(`/agenda?data=${DAY}`);
    const link = card(page, "11:00 – 11:45").getByRole("link", { name: /Enviar confirmação pelo WhatsApp/ });
    const href = (await link.getAttribute("href"))!;
    expect(href.startsWith(`https://wa.me/${PHONE_DIGITS}?text=`)).toBe(true);

    const text = decodeURIComponent(href.split("?text=")[1]);
    expect(text).toContain(`Olá ${MARK}Ana, tudo bem? 🤍`); // só o PRIMEIRO nome da cliente
    expect(text).not.toContain("Teste, tudo bem");
    expect(text).toContain("📅 Data: 15/09");
    expect(text).toContain("⏰ Horário: 11:00");
    expect(text).toContain(`💅 Procedimento: ${SERVICE}`);
    expect(text).toContain(`Manicure: ${fx.proA.name}`);
    expect(text).toContain("Está tudo certinho para você?");
    await expect(link).toHaveAttribute("target", "_blank");

    // abrir o link não muda o status
    await expect(card(page, "11:00 – 11:45")).toContainText("Aguardando confirmação");
  });
});

test.describe("telas preservadas pelo Next", () => {
  // O Next mantém as telas visitadas montadas (escondidas). Sem tratamento, um cadastro novo reabriria
  // preenchido com o anterior e o novo agendamento seria tratado como reenvio do primeiro.
  test("depois de salvar, o cadastro novo abre limpo; e o segundo agendamento é criado de verdade", async ({ page }) => {
    // serviço: salvar e reabrir "Novo serviço" por navegação interna
    await page.goto("/servicos/novo");
    await lbl(page, "Nome do serviço").fill(`${MARK} Segundo`);
    await lbl(page, /Duração padrão/).fill("30");
    await lbl(page, /Preço padrão/).fill("10");
    await page.getByRole("button", { name: "Cadastrar serviço" }).click();
    await expect(page).toHaveURL(/\/servicos\?salvo=1/);
    await page.getByRole("link", { name: "Novo serviço" }).click();
    await expect(page).toHaveURL(/\/servicos\/novo/);
    await expect(lbl(page, "Nome do serviço")).toHaveValue("");
    await expect(lbl(page, /Preço padrão/)).toHaveValue("");

    // agendamento: criar, voltar pelo botão "Novo agendamento" e criar outro
    const day = "2031-10-10";
    await bookUntilDetails(page, CLIENT, day, "09:00");
    await saveAndOpenAgenda(page);
    await expect(card(page, "09:00 – 09:45")).toBeVisible();

    await page.getByRole("link", { name: "Novo agendamento" }).click(); // botão flutuante, navegação interna
    await expect(page).toHaveURL(/\/agendamentos\/novo\/servico$|\/agendamentos\/novo\/cliente$/);
    await expect(page.getByRole("button", { pressed: true })).toHaveCount(0); // nada ficou marcado
    if (/cliente$/.test(page.url())) {
      await lbl(page, "Buscar cliente por nome ou telefone").fill(CLIENT);
      await page.getByRole("button", { name: new RegExp(CLIENT) }).first().click();
      await page.getByRole("button", { name: /Continuar/ }).click();
    }
    await page.getByRole("button", { name: new RegExp(SERVICE) }).click();
    await page.getByRole("button", { name: /Continuar/ }).click();
    // o dia da agenda vem preenchido, mas o horário do agendamento anterior NÃO
    await expect(page.getByRole("button", { name: "09:00", pressed: true })).toHaveCount(0);
    await page.getByRole("button", { name: "13:00", exact: true }).click();
    await page.getByRole("button", { name: /Continuar/ }).click();
    await saveAndOpenAgenda(page);

    // os DOIS existem: o segundo não foi engolido como "reenvio" do primeiro
    await expect(card(page, "13:00 – 13:45")).toBeVisible();
    await expect(card(page, "09:00 – 09:45")).toBeVisible();
  });
});

test.describe("agenda, início e conta", () => {
  test("navegar entre os dias, semana e 'Hoje'", async ({ page }) => {
    const fx = readFixture();
    await page.goto(`/agenda?data=${DAY}`);
    await expect(page.getByRole("heading", { name: "Segunda-feira, 15 de setembro" })).toBeVisible();
    await expect(page.getByRole("link", { name: /dia 15, 2 atendimentos/ })).toBeVisible();

    await page.getByRole("link", { name: "Próximo dia" }).click();
    await expect(page).toHaveURL(/data=2031-09-16/);
    await expect(page.getByText("Nenhum atendimento neste dia")).toBeVisible();
    await page.getByRole("link", { name: "Dia anterior" }).click();
    await expect(page).toHaveURL(/data=2031-09-15/);

    await page.getByRole("navigation", { name: "Semana" }).getByRole("link", { name: /dia 16/ }).click();
    await expect(page).toHaveURL(/data=2031-09-16/);

    await page.getByRole("link", { name: "Hoje" }).click();
    await expect(page).toHaveURL(new RegExp(`data=${fx.today}`));
  });

  test("filtro por profissional e agenda compartilhada (a colega só pode ser consultada)", async ({ page }) => {
    const fx = readFixture();
    const fixa = (p: Page) => p.locator("li").filter({ hasText: fx.clientName }).filter({ has: p.locator("a[href^='/agendamentos/']") });

    await page.goto(`/agenda?data=${fx.tomorrow}`);
    await expect(fixa(page)).toHaveCount(3); // dela (2) + da colega (1)

    // atendimento da colega: vê, mas não altera
    const colega = page.locator("li").filter({ hasText: "Alongamento" }).filter({ hasText: fx.clientName });
    await expect(colega).toBeVisible();
    await expect(colega.getByRole("button", { name: "Confirmar" })).toHaveCount(0);
    await expect(colega.getByRole("button", { name: /Mais ações/ })).toHaveCount(0);
    await expect(colega.getByRole("link", { name: /Editar atendimento/ })).toHaveCount(0);
    await expect(colega.getByRole("link", { name: /WhatsApp/ })).toBeVisible();

    await page.getByRole("navigation", { name: "Filtrar por profissional" }).getByRole("link", { name: new RegExp(fx.proB.name) }).click();
    await expect(page).toHaveURL(new RegExp(`pro=${fx.proB.id}`));
    await expect(fixa(page)).toHaveCount(1);

    await page.getByRole("navigation", { name: "Filtrar por profissional" }).getByRole("link", { name: /\(você\)/ }).click();
    await expect(fixa(page)).toHaveCount(2);

    // abrir o atendimento da colega: sem botões de alteração
    await page.goto(`/agendamentos/${fx.appointments.awaitingB}`);
    await expect(page.getByText(/só ela pode alterá-lo/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar atendimento" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Editar ou remarcar" })).toHaveCount(0);
  });

  test("detalhe do atendimento: ações completas e mensagem do WhatsApp", async ({ page }) => {
    const fx = readFixture();
    await page.goto(`/agendamentos/${fx.appointments.awaitingA}`);
    await expect(page.getByRole("button", { name: "Confirmar atendimento" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Concluir atendimento" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Não compareceu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar agendamento" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Enviar confirmação no WhatsApp" })).toBeVisible();
    await expect(page.getByText("Abrir o WhatsApp não muda o status")).toBeVisible();

    await page.getByRole("button", { name: "Confirmar atendimento" }).click();
    await expect(page.getByText("Confirmado", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Não compareceu" }).click();
    await expect(page.getByText("Não compareceu", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Reabrir atendimento" })).toBeVisible();
    await page.getByRole("button", { name: "Reabrir atendimento" }).click();
    await expect(page.getByText("Confirmado", { exact: true })).toBeVisible();
  });

  test("Início: saudação, números reais e próximos atendimentos", async ({ page }) => {
    const check = watchErrors(page);
    const fx = readFixture();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), / })).toBeVisible();
    await expect(page.getByText(/atendimentos? hoje/)).toBeVisible();
    await expect(page.getByText(/confirmaç(ão|ões) pendentes?/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Próximos atendimentos" })).toBeVisible();
    // o atendimento de hoje às 23:00 (criado pela preparação) aparece com a data
    await expect(page.locator("li").filter({ hasText: fx.clientName }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir agenda de hoje" })).toBeVisible();
    // o filtro por profissional mantém a tela
    await page.getByRole("navigation", { name: "Filtrar por profissional" }).getByRole("link", { name: new RegExp(fx.proB.name) }).click();
    await expect(page).toHaveURL(/pro=/);
    await expect(page.getByRole("heading", { name: "Próximos atendimentos" })).toBeVisible();
    check();
  });

  test("Perfil e Configurações carregam; formulário de senha valida antes de enviar", async ({ page }) => {
    const check = watchErrors(page);
    await page.goto("/perfil");
    await expect(page.getByRole("heading", { name: "Seu nome" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Senha" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "E-mail de acesso" })).toBeVisible();

    await lbl(page, "Senha atual", { exact: true }).first().fill("qualquer");
    await lbl(page, "Nova senha", { exact: true }).fill("curta");
    await lbl(page, "Repita a nova senha").fill("outra");
    await page.getByRole("button", { name: "Alterar senha" }).click();
    await expect(page.getByText(/pelo menos 8 caracteres\./).first()).toBeVisible();

    await page.goto("/configuracoes");
    await expect(page.getByRole("heading", { name: "Instalar no celular" })).toBeVisible();
    await expect(page.getByText("No iPhone (Safari)")).toBeVisible();
    check();
  });

  test("navegação inferior leva às quatro áreas e destaca a atual", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    for (const [label, url] of [["Agenda", /\/agenda/], ["Clientes", /\/clientes/], ["Menu", /\/menu/], ["Início", /\/$/]] as const) {
      await nav.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(url);
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    }
  });

  test("Sair: encerra a sessão deste aparelho e as páginas privadas voltam a pedir login", async ({ browser }) => {
    loadEnv();
    // sessão própria, para não derrubar a dos outros testes
    const state = await createSessionState(process.env.SEED_PRO1_EMAIL!, process.env.SEED_PRO1_PASSWORD!);
    const context = await browser.newContext({ storageState: state, viewport: { width: 390, height: 844 }, locale: "pt-BR" });
    const page = await context.newPage();

    await page.goto("/menu");
    await expect(page.getByRole("heading", { name: "Menu" })).toBeVisible();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/agenda");
    await expect(page).toHaveURL(/\/login$/);
    await context.close();
  });
});
