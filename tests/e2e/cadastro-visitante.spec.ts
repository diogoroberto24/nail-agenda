import { expect, test } from "@playwright/test";

/**
 * Tela de cadastro (pública), no celular. Não cria contas de verdade: o código de convite e a criação real
 * são cobertos nos testes do banco; aqui vale a tela, a validação e o acesso.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("o login tem o link 'Criar conta' que leva ao cadastro, e o cadastro volta ao login", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/cadastro$/);
  await expect(page.getByRole("heading", { level: 1, name: "Criar conta" })).toBeVisible();
  await page.getByRole("link", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("o cadastro abre sem login e mostra os campos pedidos", async ({ page }) => {
  await page.goto("/cadastro");
  await expect(page).toHaveURL(/\/cadastro$/);
  for (const label of ["Seu nome", "E-mail", "Repetir a senha", "Código de convite"]) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Criar conta" })).toBeVisible();
});

test("validação: campos vazios, senha curta e senhas diferentes aparecem antes de enviar", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Informe seu nome.")).toBeVisible();
  await expect(page.getByText("Informe seu e-mail.")).toBeVisible();
  await expect(page.getByText("Informe o código de convite.")).toBeVisible();

  await page.getByLabel("Seu nome").fill("Maria Souza");
  await page.getByLabel("E-mail").fill("maria@exemplo.com");
  await page.getByLabel("Senha", { exact: true }).fill("curta");
  await page.getByLabel("Repetir a senha").fill("outra");
  await page.getByLabel("Código de convite").fill("qualquer-codigo");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("A senha precisa ter pelo menos 8 caracteres.")).toBeVisible();
  await expect(page.getByText("As senhas não são iguais.")).toBeVisible();
  await expect(page).toHaveURL(/\/cadastro$/);
});

test("código de convite errado é recusado e nenhuma conta passa a entrar no sistema", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill("Teste Recusado");
  await page.getByLabel("E-mail").fill(`recusado-${Date.now()}@exemplo.com`);
  await page.getByLabel("Senha", { exact: true }).fill("senha-1234");
  await page.getByLabel("Repetir a senha").fill("senha-1234");
  await page.getByLabel("Código de convite").fill("codigo-que-nao-existe-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.locator("form [role=alert]")).toContainText("Código de convite inválido.");
  await expect(page).toHaveURL(/\/cadastro$/);
  await expect(page.getByLabel("Seu nome")).toHaveValue("Teste Recusado"); // campos preservados
});

test("a tela de cadastro cabe na tela e os campos têm alvo de toque de 44 px", async ({ page }) => {
  await page.goto("/cadastro");
  await page.waitForLoadState("networkidle");
  const m = await page.evaluate(() => {
    const small = [...document.querySelectorAll<HTMLElement>("a[href], button, input")]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => ({ el: (el.getAttribute("aria-label") || el.textContent || el.id).trim().slice(0, 30), h: Math.round(el.getBoundingClientRect().height), w: Math.round(el.getBoundingClientRect().width) }))
      .filter((x) => x.h < 44 || x.w < 44);
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, small };
  });
  expect(m.overflow).toBeLessThanOrEqual(0);
  expect(m.small, JSON.stringify(m.small)).toEqual([]);
});
