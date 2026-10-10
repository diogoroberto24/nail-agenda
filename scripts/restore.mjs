// Restaura, a partir de um backup, as linhas que FALTAM no banco.
// Uso:  npm run restore -- --from backups/AAAA-MM-DD_HH-MM-SS            (só mostra o que faria)
//       npm run restore -- --from backups/AAAA-MM-DD_HH-MM-SS --confirm  (grava)
//
// - Só INSERE linhas ausentes (mesmo id): nunca altera nem apaga o que já existe. Rodar de novo é seguro.
// - Pressupõe que as contas (Authentication → Users) e o salão já existem com os mesmos ids. Se o projeto
//   inteiro foi perdido, recrie primeiro o esquema (supabase/migrations/) e as contas (npm run seed) e
//   confira que os ids de salão e profissionais batem com o backup; do contrário, peça ajuda antes de gravar.
// - Roda só na sua máquina, com a chave secreta do .env.local.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { TABLES, adminFromEnv } from "./backup.mjs";

/** Chave de cada tabela, para saber o que já existe. */
const KEY = { salon_members: ["salon_id", "user_id"] };
const keyOf = (table) => KEY[table] ?? ["id"];
const rowKey = (table, row) => keyOf(table).map((k) => row[k]).join("|");
const CHUNK = 500;

export async function runRestore(fromDir, { confirm = false } = {}) {
  if (!existsSync(path.join(fromDir, "manifest.json"))) throw new Error(`Pasta de backup inválida: ${fromDir}`);
  const admin = adminFromEnv();
  const report = {};

  for (const table of TABLES) {
    const rows = JSON.parse(readFileSync(path.join(fromDir, `${table}.json`), "utf8"));
    // quais já existem?
    const existing = new Set();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from(table).select(keyOf(table).join(",")).range(from, from + 999);
      if (error) throw new Error(`Falha ao ler ${table}: ${error.message}`);
      data.forEach((r) => existing.add(rowKey(table, r)));
      if (data.length < 1000) break;
    }
    const missing = rows.filter((r) => !existing.has(rowKey(table, r)));
    report[table] = { noBackup: rows.length, faltando: missing.length, restauradas: 0 };

    if (confirm && missing.length) {
      for (let i = 0; i < missing.length; i += CHUNK) {
        // ignoreDuplicates: ON CONFLICT DO NOTHING (nunca sobrescreve)
        const { error } = await admin.from(table).upsert(missing.slice(i, i + CHUNK), { onConflict: keyOf(table).join(","), ignoreDuplicates: true });
        if (error) throw new Error(`Falha ao restaurar ${table}: ${error.message}`);
      }
      report[table].restauradas = missing.length;
    }
  }
  return report;
}

if (process.argv[1]?.endsWith("restore.mjs")) {
  const fromIndex = process.argv.indexOf("--from");
  const from = fromIndex > -1 ? process.argv[fromIndex + 1] : null;
  const confirm = process.argv.includes("--confirm");
  if (!from) {
    console.error("Informe a pasta do backup: npm run restore -- --from backups/<pasta> [--confirm]");
    process.exit(1);
  }
  try {
    const report = await runRestore(from, { confirm });
    console.log(confirm ? "Restauração concluída:" : "Simulação (nada foi gravado). Use --confirm para gravar:");
    for (const [table, r] of Object.entries(report)) console.log(`  ${table.padEnd(15)} no backup: ${String(r.noBackup).padStart(4)} | faltando: ${String(r.faltando).padStart(4)}${confirm ? ` | restauradas: ${r.restauradas}` : ""}`);
  } catch (e) {
    console.error(`Restauração FALHOU: ${e.message}`);
    process.exit(1);
  }
}
