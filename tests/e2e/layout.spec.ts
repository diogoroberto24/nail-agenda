import { expect, test, type Page } from "@playwright/test";
import { readFixture } from "./helpers";

/**
 * Responsividade e toque, nas larguras 320, 360, 390, 430 (celulares), tablet e desktop:
 *  - nenhuma página rola na horizontal;
 *  - todo alvo de toque tem pelo menos 44 × 44 px;
 *  - a barra de navegação e o botão flutuante não cobrem o conteúdo;
 *  - nenhum erro de JavaScript no console.
 */
type Fx = ReturnType<typeof readFixture>;

// os caminhos usam os dados de exemplo criados na preparação; por isso são calculados dentro de cada teste
const ROUTES: { name: string; path: (fx: Fx) => string }[] = [
  { name: "Início", path: () => "/" },
  { name: "Agenda", path: (fx) => `/agenda?data=${fx.tomorrow}` },
  { name: "Clientes", path: () => "/clientes" },
  { name: "Ficha da cliente", path: (fx) => `/clientes/${fx.clientId}` },
  { name: "Nova cliente", path: () => "/clientes/novo" },
  { name: "Serviços", path: () => "/servicos" },
  { name: "Novo serviço", path: () => "/servicos/novo" },
  { name: "Novo agendamento", path: (fx) => `/agendamentos/novo?data=${fx.tomorrow}` },
  { name: "Detalhe do atendimento", path: (fx) => `/agendamentos/${fx.appointments.confirmedA}` },
  { name: "Editar atendimento", path: (fx) => `/agendamentos/${fx.appointments.confirmedA}/editar` },
  { name: "Menu", path: () => "/menu" },
  { name: "Perfil", path: () => "/perfil" },
  { name: "Configurações", path: () => "/configuracoes" },
];

async function measure(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const overflowX = document.documentElement.scrollWidth - vw;

    // alvos de toque: tudo que o dedo pode acionar (links no meio de um parágrafo são exceção)
    const selector = 'a[href], button, input:not([type="hidden"]):not([role="checkbox"]), select, textarea, [role="radio"], summary';
    const small = [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && !el.closest("[aria-hidden=true]") && !el.closest("p");
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { el: (el.getAttribute("aria-label") || el.textContent || el.id || el.tagName).trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((x) => x.w < 44 || x.h < 44);

    // conteúdo x navegação fixa x botão flutuante (com a página rolada até o fim)
    window.scrollTo(0, document.documentElement.scrollHeight);
    const nav = document.querySelector('nav[aria-label="Navegação principal"]')?.getBoundingClientRect();
    const fab = document.querySelector('a[aria-label="Novo agendamento"]')?.getBoundingClientRect();
    const main = document.querySelector("main");
    let contentBottom = 0;
    main?.querySelectorAll<HTMLElement>("*").forEach((el) => {
      if (getComputedStyle(el).position === "fixed") return;
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.width > 0) contentBottom = Math.max(contentBottom, r.bottom);
    });
    return { overflowX, small, navTop: nav?.top ?? null, fabTop: fab?.top ?? null, contentBottom };
  });
}

for (const route of ROUTES) {
  test(route.name, async ({ page }) => {
    const path = route.path(readFixture());
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForLoadState("networkidle");

    const m = await measure(page);
    expect(m.overflowX, "rolagem horizontal da página").toBeLessThanOrEqual(0);
    expect(m.small, `alvos de toque menores que 44 px: ${JSON.stringify(m.small)}`).toEqual([]);
    expect(m.navTop, "barra de navegação inferior presente").not.toBeNull();
    // o conteúdo termina acima da barra (e acima do botão flutuante, quando ele existe)
    expect(m.contentBottom).toBeLessThanOrEqual((m.fabTop ?? m.navTop!) + 1);
    expect(errors, `erros no console: ${errors.join(" | ")}`).toEqual([]);
  });
}
