import { expect, test } from "@playwright/test";

/** Tela de cadastro nas larguras 320, 360, 390, 430, tablet e desktop: sem rolagem horizontal e com alvos de 44 px. */
test.use({ storageState: { cookies: [], origins: [] } });

test("Cadastro (pública)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  for (const path of ["/login", "/cadastro"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const m = await page.evaluate(() => {
      const small = [...document.querySelectorAll<HTMLElement>("a[href], button, input:not([type=checkbox])")]
        .filter((el) => el.getBoundingClientRect().width > 0)
        .map((el) => ({ el: (el.getAttribute("aria-label") || el.textContent || el.id).trim().slice(0, 30), h: Math.round(el.getBoundingClientRect().height), w: Math.round(el.getBoundingClientRect().width) }))
        .filter((x) => x.h < 44 || x.w < 44);
      return { overflow: document.documentElement.scrollWidth - window.innerWidth, small };
    });
    expect(m.overflow, `${path}: rolagem horizontal`).toBeLessThanOrEqual(0);
    expect(m.small, `${path}: alvos pequenos ${JSON.stringify(m.small)}`).toEqual([]);
  }

  // erros de validação exibidos também não estouram a largura
  await page.getByRole("link", { name: "Entrar" }).click();
  await page.getByRole("link", { name: "Criar conta" }).click();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Informe seu nome.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  expect(errors, `erros no console: ${errors.join(" | ")}`).toEqual([]);
});
