// Cria o salão e as duas profissionais de teste no Supabase.
// Uso:  npm run seed      (lê o .env.local; precisa da SUPABASE_SECRET_KEY)
// É idempotente: pode rodar de novo sem duplicar nada.
// Roda só na sua máquina. A chave secreta ignora o RLS: nunca a coloque no navegador nem na Vercel.

import { createClient } from "@supabase/supabase-js";

const env = process.env;
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SEED_PRO1_EMAIL",
  "SEED_PRO1_PASSWORD",
  "SEED_PRO2_EMAIL",
  "SEED_PRO2_PASSWORD",
];
const missing = required.filter((k) => !env[k]);
if (missing.length) {
  console.error(`Faltam variáveis no .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

for (const k of ["SEED_PRO1_PASSWORD", "SEED_PRO2_PASSWORD"]) {
  if (env[k].length < 8) {
    console.error(`${k} precisa ter pelo menos 8 caracteres.`);
    process.exit(1);
  }
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function fail(step, error) {
  console.error(`Falhou em "${step}": ${error.message}`);
  process.exit(1);
}

const salonName = env.SEED_SALON_NAME || "Salão de Unhas";

// 1. salão (reaproveita se já existir um com o mesmo nome)
let { data: salon, error } = await admin.from("salons").select("id").eq("name", salonName).maybeSingle();
if (error) fail("buscar salão", error);
if (!salon) {
  ({ data: salon, error } = await admin.from("salons").insert({ name: salonName }).select("id").single());
  if (error) fail("criar salão", error);
}

// 2. contas
async function ensureUser({ email, password, name }) {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (!created.error) return created.data.user;

  // já existe? procura nas contas (poucas contas: uma página basta)
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) fail(`listar contas (${email})`, list.error);
  const existing = list.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) fail(`criar conta (${email})`, created.error);
  return existing;
}

const pros = [
  { email: env.SEED_PRO1_EMAIL, password: env.SEED_PRO1_PASSWORD, name: env.SEED_PRO1_NAME || "Profissional 1", role: "owner" },
  { email: env.SEED_PRO2_EMAIL, password: env.SEED_PRO2_PASSWORD, name: env.SEED_PRO2_NAME || "Profissional 2", role: "professional" },
];

for (const p of pros) {
  const user = await ensureUser(p);

  const member = await admin
    .from("salon_members")
    .upsert({ salon_id: salon.id, user_id: user.id, role: p.role }, { onConflict: "salon_id,user_id" });
  if (member.error) fail(`vincular ao salão (${p.email})`, member.error);

  const prof = await admin
    .from("professionals")
    .upsert(
      { salon_id: salon.id, user_id: user.id, display_name: p.name, active: true },
      { onConflict: "salon_id,user_id" },
    );
  if (prof.error) fail(`criar profissional (${p.email})`, prof.error);

  console.log(`OK: ${p.name} <${p.email}>`);
}

console.log("Seed concluído.");
