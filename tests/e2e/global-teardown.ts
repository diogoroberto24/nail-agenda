import { cleanup, loadEnv } from "./helpers";

/** Apaga todos os dados criados pelos testes E2E, mesmo os criados pela interface. */
export default async function globalTeardown() {
  loadEnv();
  await cleanup();
}
