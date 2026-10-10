import { expect, type Page } from "@playwright/test";

/**
 * Mede a tela atual: rolagem horizontal, alvos de toque (mínimo de 44 px) e se a barra de navegação
 * e o botão flutuante cobrem o conteúdo (com a página rolada até o fim).
 */
export async function measure(page: Page) {
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
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    const nav = document.querySelector('nav[aria-label="Navegação principal"]')?.getBoundingClientRect();
    const fab = document.querySelector('a[aria-label="Novo agendamento"]')?.getBoundingClientRect();
    const footer = [...document.querySelectorAll("[data-wizard-footer]")].map((f) => f.getBoundingClientRect()).find((r) => r.height > 0);
    const main = document.querySelector("main");
    let contentBottom = 0;
    main?.querySelectorAll<HTMLElement>("*").forEach((el) => {
      // não contam: elementos fixos, espaçadores (aria-hidden) e o conteúdo do próprio rodapé "Continuar"
      if (getComputedStyle(el).position === "fixed" || el.closest("[aria-hidden=true]") || el.closest("[data-wizard-footer]")) return;
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.width > 0) contentBottom = Math.max(contentBottom, r.bottom);
    });
    return { overflowX, small, navTop: nav?.top ?? null, fabTop: fab?.top ?? null, footerTop: footer?.top ?? null, contentBottom };
  });
}

/** Falha o teste se a tela atual tiver rolagem horizontal, alvos de toque pequenos ou conteúdo coberto. */
export async function expectLayoutOk(page: Page) {
  const m = await measure(page);
  expect(m.overflowX, "rolagem horizontal da página").toBeLessThanOrEqual(0);
  expect(m.small, `alvos de toque menores que 44 px: ${JSON.stringify(m.small)}`).toEqual([]);
  expect(m.navTop, "barra de navegação inferior presente").not.toBeNull();
  // o conteúdo termina acima da barra, do botão flutuante e do rodapé "Continuar" (quando existem)
  expect(m.contentBottom).toBeLessThanOrEqual(Math.min(m.navTop!, m.fabTop ?? Infinity, m.footerTop ?? Infinity) + 1);
}
