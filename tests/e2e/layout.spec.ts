import { expect, test } from "@playwright/test";
import { expectLayoutOk } from "./measure";
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

for (const route of ROUTES) {
  test(route.name, async ({ page }) => {
    const path = route.path(readFixture());
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForLoadState("networkidle");

    await expectLayoutOk(page);
    expect(errors, `erros no console: ${errors.join(" | ")}`).toEqual([]);
  });
}
