// Cópia de segurança dos dados do salão em arquivos JSON.
// Uso:  npm run backup                    (grava em backups/AAAA-MM-DD_HH-MM-SS/)
//       npm run backup -- --out <pasta>   (grava na pasta indicada)
//
// - Exporta as 9 tabelas e a lista de contas (id, e-mail, datas; SEM senhas).
// - Confere, ao final, se a quantidade de linhas gravadas é igual à do banco. Se não for, falha.
// - A pasta backups/ está no .gitignore: os arquivos têm dados pessoais das clientes. Guarde-os em
//   local seguro (por exemplo, um disco ou nuvem privada) e nunca no repositório.
// - Roda só na sua máquina, com a chave secreta do .env.local (nunca na Vercel).

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Ordem que respeita as chaves estrangeiras (usada também na restauração). */
export const TABLES = ["salons", "salon_members", "professionals", "profiles", "clients", "services", "appointments", "business_hours", "blocked_times"];
const PAGE = 1000;

export function adminFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fetchAll(admin, table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    // ordena por uma coluna estável para a paginação não repetir nem pular linhas
    const { data, error } = await admin.from(table).select("*").order("created_at", { ascending: true }).order("id", { ascending: true, nullsFirst: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(`Falha ao ler ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

/** salon_members não tem coluna id: ordena só por created_at. */
async function fetchTable(admin, table) {
  if (table !== "salon_members") return fetchAll(admin, table);
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from(table).select("*").order("created_at", { ascending: true }).order("user_id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(`Falha ao ler ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

export async function runBackup(outDir) {
  const admin = adminFromEnv();
  mkdirSync(outDir, { recursive: true });

  const counts = {};
  for (const table of TABLES) {
    const rows = await fetchTable(admin, table);
    writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`Falha ao contar ${table}: ${error.message}`);
    if (count !== rows.length) throw new Error(`Conferência falhou em ${table}: banco tem ${count} linhas, o backup tem ${rows.length}.`);
    counts[table] = rows.length;
  }

  // contas (sem senhas nem tokens)
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Falha ao ler as contas: ${error.message}`);
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at })));
    if (data.users.length < 200) break;
  }
  writeFileSync(path.join(outDir, "auth_users.json"), JSON.stringify(users, null, 2));
  counts.auth_users = users.length;

  const manifest = { created_at: new Date().toISOString(), source: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host.replace(/^[^.]+/, "<projeto>"), counts };
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

// execução direta: node scripts/backup.mjs [--out pasta]
if (process.argv[1]?.endsWith("backup.mjs")) {
  const outIndex = process.argv.indexOf("--out");
  const stamp = new Date().toISOString().replace("T", "_").replace(/:/g, "-").slice(0, 19);
  const outDir = outIndex > -1 ? process.argv[outIndex + 1] : path.join("backups", stamp);
  try {
    const manifest = await runBackup(outDir);
    console.log(`Backup concluído em ${outDir}`);
    for (const [table, n] of Object.entries(manifest.counts)) console.log(`  ${table.padEnd(15)} ${n}`);
    console.log("Guarde esta pasta em local seguro: ela contém dados pessoais das clientes.");
  } catch (e) {
    console.error(`Backup FALHOU: ${e.message}`);
    process.exit(1);
  }
}
