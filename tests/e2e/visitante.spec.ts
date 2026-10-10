import { expect, test } from "@playwright/test";

const PRIVATE_ROUTES = ["/", "/agenda", "/clientes", "/clientes/novo", "/servicos", "/agendamentos/novo", "/perfil", "/menu", "/configuracoes"];

test.describe("visitante sem login", () => {
  for (const route of PRIVATE_ROUTES) {
    test(`${route} leva para o login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: "Nail Agenda" })).toBeVisible();
    });
  }

  test("a rota de acesso negado também termina no login (sem sessão)", async ({ page }) => {
    await page.goto("/auth/acesso-negado");
    await expect(page).toHaveURL(/\/login/);
  });

  test("dados privados não vazam: o HTML do login não contém clientes nem agenda", async ({ page }) => {
    const response = await page.goto("/agenda");
    const html = await response!.text();
    expect(html).not.toContain("__e2e__");
    expect(html).not.toContain("atendimentos neste dia");
  });

  test("tela de login: erros junto dos campos, 'lembrar de mim' marcado e senha com mostrar/ocultar", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Lembrar de mim neste aparelho")).toBeChecked();

    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Informe seu e-mail.")).toBeVisible();
    await expect(page.getByText("Informe sua senha.")).toBeVisible();

    const password = page.getByLabel("Senha", { exact: true });
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Mostrar senha" }).click();
    await expect(password).toHaveAttribute("type", "text");

    await page.getByLabel("E-mail").fill("isso-nao-e-email");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail inválido.")).toBeVisible();
  });

  test("tela de login cabe na tela sem rolagem horizontal", async ({ page }) => {
    await page.goto("/login");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("manifesto do app é público e descreve um app instalável", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest).toMatchObject({ name: "Nail Agenda", display: "standalone", start_url: "/", lang: "pt-BR" });
    expect(manifest.background_color).toBe("#faf8f5");
    const sizes = manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));
  });

  test("todos os ícones do manifesto, o favicon e o ícone do iPhone abrem sem login", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    for (const icon of [...manifest.icons.map((i: { src: string }) => i.src), "/icon.png", "/apple-icon.png"]) {
      const res = await request.get(icon);
      expect(res.status(), icon).toBe(200);
      expect(res.headers()["content-type"], icon).toContain("image/png");
      expect((await res.body()).length, icon).toBeGreaterThan(500);
    }
  });

  test("a página declara manifesto, ícone do iPhone e cor do tema", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#faf8f5");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  });
});
