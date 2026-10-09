import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testes contra o Supabase REAL (precisa do .env.local). Uso: npm run test:integration
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
