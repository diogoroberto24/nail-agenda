import { defineConfig } from "@playwright/test";

/**
 * Testes de ponta a ponta em tela de celular, contra o app compilado (npm run build + start)
 * e o Supabase REAL do .env.local. Usam o Microsoft Edge já instalado (nenhum navegador é baixado).
 * Uso: npm run test:e2e
 *
 * A sessão das testes é criada pela API com a conta de teste do seed (não se digita senha em formulário).
 */
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

const mobile = (width: number, height: number) => ({
  channel: "msedge" as const,
  viewport: { width, height },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  locale: "pt-BR",
  timezoneId: "America/Sao_Paulo",
  storageState: "tests/e2e/.auth/pro-a.json",
});

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: { baseURL: BASE_URL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/login`,
    timeout: 300_000,
    reuseExistingServer: false,
  },
  projects: [
    // visitante sem login: proteção de rotas, tela de login e manifesto do app
    { name: "visitante", testMatch: /visitante\.spec\.ts/, use: { ...mobile(390, 844), storageState: { cookies: [], origins: [] } } },
    // fluxo completo de uso, como a profissional usa no celular
    { name: "fluxo-390", testMatch: /(fluxo|wizard)\.spec\.ts/, use: mobile(390, 844) },
    // responsividade nas larguras pedidas + tablet e desktop
    { name: "layout-320", testMatch: /layout\.spec\.ts/, use: mobile(320, 568) },
    { name: "layout-360", testMatch: /layout\.spec\.ts/, use: mobile(360, 800) },
    { name: "layout-390", testMatch: /layout\.spec\.ts/, use: mobile(390, 844) },
    { name: "layout-430", testMatch: /layout\.spec\.ts/, use: mobile(430, 932) },
    { name: "layout-tablet", testMatch: /layout\.spec\.ts/, use: { ...mobile(768, 1024), isMobile: false } },
    { name: "layout-desktop", testMatch: /layout\.spec\.ts/, use: { ...mobile(1280, 800), isMobile: false, hasTouch: false } },
  ],
});
