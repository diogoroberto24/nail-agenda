import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Testa o esquema e as políticas RLS num Postgres em memória (PGlite).
// Simula o ambiente do Supabase (papéis anon/authenticated e auth.uid()) com stubs mínimos.
// Uso: npm run test:db
const MIG = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));
const db = new PGlite();

let passed = 0;
const failures = [];
function record(name, ok, detail = "") {
  if (ok) passed++;
  else failures.push(`${name} ${detail}`);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + detail}`);
}

// ---- stubs do ambiente Supabase
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
`);

await db.exec(readFileSync(MIG + "20261009000001_schema.sql", "utf8"));
await db.exec(readFileSync(MIG + "20261009000002_rls_policies.sql", "utf8"));
await db.exec(readFileSync(MIG + "20261009000003_service_role_grants.sql", "utf8"));
await db.exec(readFileSync(MIG + "20261010000001_agenda_privada.sql", "utf8"));
await db.exec(readFileSync(MIG + "20261010000002_cadastro_convite.sql", "utf8"));
await db.exec(readFileSync(MIG + "20261011000001_aniversario_clientes.sql", "utf8"));
// as migrações novas são idempotentes: rodar de novo não pode falhar
await db.exec(readFileSync(MIG + "20261010000001_agenda_privada.sql", "utf8"));
await db.exec(readFileSync(MIG + "20261010000002_cadastro_convite.sql", "utf8"));
await db.exec(readFileSync(MIG + "20261011000001_aniversario_clientes.sql", "utf8"));
record("migrações 0001, 0002 e 0003 executam sem erro", true);

// ---- dados base (superusuária = papel de administração)
const U = {
  A: "00000000-0000-0000-0000-00000000000a",
  B: "00000000-0000-0000-0000-00000000000b",
  C: "00000000-0000-0000-0000-00000000000c", // sem salão
  D: "00000000-0000-0000-0000-00000000000d", // outro salão
};
const S1 = "10000000-0000-0000-0000-000000000001";
const S2 = "10000000-0000-0000-0000-000000000002";
const PA = "20000000-0000-0000-0000-00000000000a";
const PB = "20000000-0000-0000-0000-00000000000b";
const PD = "20000000-0000-0000-0000-00000000000d";

for (const [k, id] of Object.entries(U)) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id, `${k}@t.test`, JSON.stringify({ full_name: `Pessoa ${k}` }),
  ]);
}
await db.exec(`
  insert into public.salons (id, name) values ('${S1}', 'Salao 1'), ('${S2}', 'Salao 2');
  insert into public.salon_members (salon_id, user_id, role) values
    ('${S1}', '${U.A}', 'owner'), ('${S1}', '${U.B}', 'professional'), ('${S2}', '${U.D}', 'owner');
  insert into public.professionals (id, salon_id, user_id, display_name) values
    ('${PA}', '${S1}', '${U.A}', 'Ana'), ('${PB}', '${S1}', '${U.B}', 'Bia'), ('${PD}', '${S2}', '${U.D}', 'Dani');
`);

const prof = await db.query("select count(*)::int n from public.profiles");
record("trigger cria um profile para cada conta", prof.rows[0].n === 4, JSON.stringify(prof.rows));

// ---- helpers de papel
async function as(userId, fn) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(userId ? "set role authenticated" : "set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
async function expectError(name, fn, re) {
  try {
    await fn();
    record(name, false, "não deu erro");
  } catch (e) {
    record(name, re.test(e.message), `erro inesperado: ${e.message}`);
  }
}
async function rows(sql, params) {
  return (await db.query(sql, params)).rows;
}

// ---- dados de teste (como admin)
await db.exec(`
  insert into public.clients (id, salon_id, full_name, phone, created_by) values
    ('30000000-0000-0000-0000-000000000001', '${S1}', 'Cliente 1', '5511999990001', '${U.A}'),
    ('30000000-0000-0000-0000-000000000002', '${S2}', 'Cliente S2', '5511999990002', '${U.D}');
  insert into public.services (id, salon_id, professional_id, name, default_duration_minutes, default_price) values
    ('40000000-0000-0000-0000-00000000000a', '${S1}', '${PA}', 'Esmaltação (Ana)', 40, 50),
    ('40000000-0000-0000-0000-00000000000b', '${S1}', '${PB}', 'Alongamento (Bia)', 120, 180);
`);
const C1 = "30000000-0000-0000-0000-000000000001";
const CS2 = "30000000-0000-0000-0000-000000000002";
const SA = "40000000-0000-0000-0000-00000000000a";
const SB = "40000000-0000-0000-0000-00000000000b";

// ---- service_role (script de seed) tem acesso; anon continua sem nenhum
const TABLES = ["profiles","salons","salon_members","professionals","clients","services","appointments","business_hours","blocked_times"];
for (const tb of TABLES) {
  const r = await rows("select has_table_privilege('service_role', $1, 'select,insert,update') a, has_table_privilege('anon', $1, 'select') b", ["public." + tb]);
  record("service_role acessa " + tb + " e anon não", r[0].a === true && r[0].b === false, JSON.stringify(r[0]));
}

// ---- isolamento
await expectError("anon não lê clients", () => as(null, () => rows("select * from public.clients")), /permission denied/i);
await expectError("anon não lê appointments", () => as(null, () => rows("select * from public.appointments")), /permission denied/i);
record("A (salão 1) vê só clientes do salão 1", (await as(U.A, () => rows("select id from public.clients"))).length === 1);
record("D (salão 2) vê só clientes do salão 2", (await as(U.D, () => rows("select id from public.clients"))).length === 1);
record("C (sem salão) não vê nenhum cliente", (await as(U.C, () => rows("select id from public.clients"))).length === 0);
record("C não vê salões", (await as(U.C, () => rows("select id from public.salons"))).length === 0);
record("A vê só o salão 1 e seus 2 membros",
  (await as(U.A, () => rows("select id from public.salons"))).length === 1 &&
  (await as(U.A, () => rows("select user_id from public.salon_members"))).length === 2);
record("A vê os profiles de A e B, mas não o de D",
  (await as(U.A, () => rows("select id from public.profiles"))).length === 2);

// ---- clientes
await as(U.A, () => db.query(`insert into public.clients (salon_id, full_name, phone) values ($1, 'Nova', '5511988887777')`, [S1]));
record("A cadastra cliente no próprio salão (created_by = auth.uid())", true);
await expectError("A não cadastra cliente em outro salão",
  () => as(U.A, () => db.query(`insert into public.clients (salon_id, full_name, phone) values ($1, 'X', '5511988887777')`, [S2])), /row-level security/i);
await expectError("A não forja created_by",
  () => as(U.A, () => db.query(`insert into public.clients (salon_id, full_name, phone, created_by) values ($1, 'X', '5511988887777', $2)`, [S1, U.B])), /row-level security/i);
await expectError("telefone inválido é recusado",
  () => as(U.A, () => db.query(`insert into public.clients (salon_id, full_name, phone) values ($1, 'X', '123')`, [S1])), /check constraint/i);
await as(U.A, () => db.query(`insert into public.clients (salon_id, full_name, phone) values ($1, 'Dup', '5511999990001')`, [S1]));
record("telefone repetido NÃO é bloqueado (a aplicação avisa)", true);
await expectError("A não apaga cliente (sem DELETE)", () => as(U.A, () => db.query(`delete from public.clients where id = $1`, [C1])), /permission denied/i);
await as(U.B, () => db.query(`update public.clients set archived_at = now() where id = $1`, [C1]));
record("B pode arquivar cliente compartilhado",
  (await rows("select archived_at from public.clients where id = $1", [C1]))[0].archived_at !== null);
await expectError("D não altera cliente de outro salão (0 linhas)", async () => {
  const r = await as(U.D, () => db.query(`update public.clients set notes = 'hack' where id = $1`, [C1]));
  if (r.affectedRows === 0) throw new Error("0 linhas afetadas");
}, /0 linhas/);
await expectError("update não muda salon_id (coluna sem permissão)",
  () => as(U.A, () => db.query(`update public.clients set salon_id = $1 where id = $2`, [S2, C1])), /permission denied/i);

// ---- serviços individuais
await as(U.A, () => db.query(`insert into public.services (salon_id, professional_id, name, default_duration_minutes, default_price) values ($1,$2,'Spa',30,40)`, [S1, PA]));
record("A cria serviço para si mesma", true);
await expectError("A não cria serviço para B",
  () => as(U.A, () => db.query(`insert into public.services (salon_id, professional_id, name, default_duration_minutes, default_price) values ($1,$2,'Spa',30,40)`, [S1, PB])), /row-level security/i);
await expectError("B não altera serviço da A (0 linhas)", async () => {
  const r = await as(U.B, () => db.query(`update public.services set default_price = 1 where id = $1`, [SA]));
  if (r.affectedRows === 0) throw new Error("0 linhas afetadas");
}, /0 linhas/);
await as(U.A, () => db.query(`update public.services set default_price = 55 where id = $1`, [SA]));
record("A altera o preço do próprio serviço", (await rows("select default_price from public.services where id = $1", [SA]))[0].default_price === "55.00");
await expectError("preço negativo é recusado", () => db.query(`update public.services set default_price = -1 where id = $1`, [SA]), /check constraint/i);
await expectError("duração zero é recusada", () => db.query(`update public.services set default_duration_minutes = 0 where id = $1`, [SA]), /check constraint/i);
await expectError("A não apaga serviço (sem DELETE)", () => as(U.A, () => db.query(`delete from public.services where id = $1`, [SA])), /permission denied/i);

// ---- atendimentos
const T0 = "2026-11-10T13:00:00Z"; // 10:00 em São Paulo
const ins = (pro, svc, client, start, mins, price, extra = "") =>
  db.query(
    `insert into public.appointments (salon_id, professional_id, client_id, service_id, start_at, end_at, duration_minutes_at_booking, price_at_booking ${extra ? "," + extra.cols : ""})
     values ($1,$2,$3,$4,$5::timestamptz, $5::timestamptz + make_interval(mins => $6::int), $6::int, $7 ${extra ? "," + extra.vals : ""}) returning id`,
    [S1, pro, client, svc, start, mins, price],
  );
const apA = (await as(U.A, () => ins(PA, SA, C1, T0, 40, 55))).rows[0].id;
record("A cria atendimento para si (status inicial = aguardando confirmação)",
  (await rows("select status from public.appointments where id = $1", [apA]))[0].status === "awaiting_confirmation");
await as(U.B, () => ins(PB, SB, C1, T0, 120, 180));
record("B atende no MESMO horário que A (profissionais diferentes)", true);
await as(U.A, () => ins(PA, SA, C1, "2026-11-10T13:20:00Z", 40, 55));
record("mesma profissional com horário sobreposto NÃO é bloqueada (só aviso)", true);
await as(U.A, () => ins(PA, SA, C1, "2026-11-10T13:40:00Z", 40, 55));
record("atendimentos consecutivos (fim = início) são aceitos", true);
await expectError("serviço de outra profissional é recusado", () => as(U.A, () => ins(PA, SB, C1, T0, 120, 180)), /foreign key/i);
await expectError("cliente de outro salão é recusado", () => as(U.A, () => ins(PA, SA, CS2, T0, 40, 55)), /foreign key/i);
await expectError("fim incoerente com a duração é recusado",
  () => as(U.A, () => db.query(`insert into public.appointments (salon_id, professional_id, client_id, service_id, start_at, end_at, duration_minutes_at_booking, price_at_booking) values ($1,$2,$3,$4,$5::timestamptz, $5::timestamptz + interval '10 minutes', 40, 55)`, [S1, PA, C1, SA, T0])), /check constraint/i);
await expectError("fim antes do início é recusado",
  () => as(U.A, () => db.query(`insert into public.appointments (salon_id, professional_id, client_id, service_id, start_at, end_at, duration_minutes_at_booking, price_at_booking) values ($1,$2,$3,$4,$5::timestamptz, $5::timestamptz - interval '40 minutes', 40, 55)`, [S1, PA, C1, SA, T0])), /check constraint/i);
await expectError("status inválido é recusado",
  () => as(U.A, () => db.query(`update public.appointments set status = 'qualquer' where id = $1`, [apA])), /check constraint/i);
for (const st of ["confirmed", "completed", "no_show", "cancelled"]) {
  await as(U.A, () => db.query(`update public.appointments set status = $1 where id = $2`, [st, apA]));
}
record("os 5 status são aceitos (A atualiza o próprio atendimento)", true);
await expectError("B NÃO altera atendimento da A (0 linhas)", async () => {
  const r = await as(U.B, () => db.query(`update public.appointments set status = $1 where id = $2`, ["confirmed", apA]));
  if (r.affectedRows === 0) throw new Error("0 linhas afetadas");
}, /0 linhas/);
await expectError("B NÃO cria atendimento para a A", () => as(U.B, () => ins(PA, SA, C1, T0, 40, 55)), /row-level security/i);
await expectError("A NÃO passa o próprio atendimento para a B",
  () => as(U.A, () => db.query(`update public.appointments set professional_id = $1 where id = $2`, [PB, apA])), /row-level security|foreign key/i);
// agenda privada: cada profissional vê só os próprios atendimentos
record("B NÃO enxerga o atendimento da A (agenda privada)",
  (await as(U.B, () => rows("select id from public.appointments where id = $1", [apA]))).length === 0);
record("B não vê nenhum atendimento da A nem numa listagem geral",
  (await as(U.B, () => rows("select id from public.appointments where professional_id = $1", [PA]))).length === 0);
record("A enxerga o próprio atendimento",
  (await as(U.A, () => rows("select id from public.appointments where id = $1", [apA]))).length === 1);
record("A só vê atendimentos da própria profissional",
  (await as(U.A, () => rows("select distinct professional_id from public.appointments"))).every((r) => r.professional_id === PA));
record("clientes continuam compartilhados (B vê cliente cadastrada pela A)",
  (await as(U.B, () => rows("select id from public.clients where id = $1", [C1]))).length === 1);
record("serviços continuam compartilhados (B vê serviço da A)",
  (await as(U.B, () => rows("select id from public.services where id = $1", [SA]))).length === 1);
await as(U.A, () => db.query(`update public.appointments set status = 'cancelled' where id = $1`, [apA]));
record("cancelar sem motivo é permitido (cancellation_reason opcional)", true);
await expectError("D não altera atendimento de outro salão (0 linhas)", async () => {
  const r = await as(U.D, () => db.query(`update public.appointments set notes = 'x' where id = $1`, [apA]));
  if (r.affectedRows === 0) throw new Error("0 linhas afetadas");
}, /0 linhas/);
await expectError("A não apaga atendimento (sem DELETE)", () => as(U.A, () => db.query(`delete from public.appointments where id = $1`, [apA])), /permission denied/i);
await expectError("update não muda salon_id do atendimento", () => as(U.A, () => db.query(`update public.appointments set salon_id = $1 where id = $2`, [S2, apA])), /permission denied/i);
await expectError("update não muda created_by", () => as(U.A, () => db.query(`update public.appointments set created_by = $1 where id = $2`, [U.B, apA])), /permission denied/i);
await expectError("não forja created_by ao criar atendimento",
  () => as(U.A, () => db.query(`insert into public.appointments (salon_id, professional_id, client_id, service_id, start_at, end_at, duration_minutes_at_booking, price_at_booking, created_by) values ($1,$2,$3,$4,$5::timestamptz, $5::timestamptz + interval '40 minutes', 40, 55, $6)`, [S1, PA, C1, SA, T0, U.B])), /row-level security/i);
record("C (sem salão) não vê atendimentos", (await as(U.C, () => rows("select id from public.appointments"))).length === 0);
record("D não vê atendimentos do salão 1", (await as(U.D, () => rows("select id from public.appointments"))).length === 0);

// preço/duração congelados: mudar o serviço não altera o atendimento
await db.query(`update public.services set default_price = 99, default_duration_minutes = 90 where id = $1`, [SA]);
const frozen = (await rows("select price_at_booking p, duration_minutes_at_booking d from public.appointments where id = $1", [apA]))[0];
record("histórico preservado ao mudar o serviço", frozen.p === "55.00" && frozen.d === 40, JSON.stringify(frozen));

// ---- profissionais / membros
await expectError("A não altera o nome de exibição da B (0 linhas)", async () => {
  const r = await as(U.A, () => db.query(`update public.professionals set display_name = 'hack' where id = $1`, [PB]));
  if (r.affectedRows === 0) throw new Error("0 linhas afetadas");
}, /0 linhas/);
await as(U.A, () => db.query(`update public.professionals set display_name = 'Ana Paula' where id = $1`, [PA]));
record("A altera o próprio nome de exibição", true);
await expectError("A não troca o salão da profissional", () => as(U.A, () => db.query(`update public.professionals set salon_id = $1 where id = $2`, [S2, PA])), /permission denied/i);
await expectError("A não se promove nem cria membros", () => as(U.A, () => db.query(`insert into public.salon_members (salon_id, user_id) values ($1, $2)`, [S1, U.C])), /permission denied/i);
await expectError("A não altera o próprio papel", () => as(U.B, () => db.query(`update public.salon_members set role = 'owner' where user_id = $1`, [U.B])), /permission denied/i);
await expectError("A não cria salão", () => as(U.A, () => db.query(`insert into public.salons (name) values ('x')`)), /permission denied/i);
await expectError("profissional precisa ser membro do salão",
  () => db.query(`insert into public.professionals (salon_id, user_id, display_name) values ($1, $2, 'Intrusa')`, [S1, U.C]), /foreign key/i);

// ---- profiles
await as(U.A, () => db.query(`update public.profiles set full_name = 'Ana' where id = $1`, [U.A]));
record("A altera o próprio profile", true);
await expectError("A não altera o profile da B (0 linhas)", async () => {
  const r = await as(U.A, () => db.query(`update public.profiles set full_name = 'x' where id = $1`, [U.B]));
  if (r.affectedRows === 0) throw new Error("0 linhas afetadas");
}, /0 linhas/);

// ---- disponibilidade e bloqueios
await as(U.A, () => db.query(`insert into public.business_hours (salon_id, professional_id, weekday, start_time, end_time) values ($1,$2,1,'09:00','12:00'), ($1,$2,1,'13:00','18:00')`, [S1, PA]));
record("A cadastra duas janelas no mesmo dia (pausa = intervalo entre elas)", true);
await expectError("horário final antes do inicial é recusado",
  () => as(U.A, () => db.query(`insert into public.business_hours (salon_id, professional_id, weekday, start_time, end_time) values ($1,$2,2,'18:00','09:00')`, [S1, PA])), /check constraint/i);
await expectError("dia da semana inválido é recusado",
  () => as(U.A, () => db.query(`insert into public.business_hours (salon_id, professional_id, weekday, start_time, end_time) values ($1,$2,9,'09:00','10:00')`, [S1, PA])), /check constraint/i);
await expectError("A não define expediente da B",
  () => as(U.A, () => db.query(`insert into public.business_hours (salon_id, professional_id, weekday, start_time, end_time) values ($1,$2,1,'09:00','12:00')`, [S1, PB])), /row-level security/i);
record("B enxerga o expediente da A", (await as(U.B, () => rows("select id from public.business_hours"))).length === 2);
await as(U.A, () => db.query(`insert into public.blocked_times (salon_id, professional_id, kind, start_at, end_at) values ($1,$2,'vacation','2026-12-20T00:00:00Z','2027-01-05T00:00:00Z')`, [S1, PA]));
record("A cadastra férias", true);
await expectError("bloqueio com fim antes do início é recusado",
  () => as(U.A, () => db.query(`insert into public.blocked_times (salon_id, professional_id, start_at, end_at) values ($1,$2,'2026-12-20T10:00:00Z','2026-12-20T09:00:00Z')`, [S1, PA])), /check constraint/i);
await expectError("B não apaga bloqueio da A (0 linhas)", async () => {
  const r = await as(U.B, () => db.query(`delete from public.blocked_times`));
  if (r.affectedRows === 0) throw new Error("0 linhas afetadas");
}, /0 linhas/);
await as(U.A, () => db.query(`delete from public.blocked_times`));
record("A apaga o próprio bloqueio", (await rows("select 1 from public.blocked_times")).length === 0);

// ---- updated_at
const before = (await rows("select updated_at u from public.clients where id = $1", [C1]))[0].u;
await new Promise((r) => setTimeout(r, 20));
await db.query(`update public.clients set notes = 'n' where id = $1`, [C1]);
const after = (await rows("select updated_at u from public.clients where id = $1", [C1]))[0].u;
record("updated_at é atualizado automaticamente", after > before);

// ---- aniversário da cliente
const setBirth = (who, d, m, y) => as(who, () => db.query("update public.clients set birth_day = $1, birth_month = $2, birth_year = $3 where id = $4", [d, m, y, C1]));
const birth = async () => (await rows("select birth_day d, birth_month m, birth_year y from public.clients where id = $1", [C1]))[0];

record("cliente sem aniversário continua válida", (await birth()).d === null);
await setBirth(U.A, 15, 3, null);
record("A grava dia e mês (ano opcional)", JSON.stringify(await birth()) === JSON.stringify({ d: 15, m: 3, y: null }));
await setBirth(U.B, 29, 2, 2000);
record("B (colega) também edita o cadastro compartilhado, inclusive 29/02 em ano bissexto", JSON.stringify(await birth()) === JSON.stringify({ d: 29, m: 2, y: 2000 }));
await setBirth(U.A, 29, 2, null);
record("29/02 sem ano é aceito", (await birth()).d === 29);
for (const [d, m, y, why] of [
  [31, 2, null, "31/02"], [30, 2, null, "30/02"], [31, 4, null, "31/04"], [0, 5, null, "dia 0"], [10, 13, null, "mês 13"], [10, 0, null, "mês 0"],
  [29, 2, 2001, "29/02 em ano não bissexto"], [29, 2, 1900, "29/02 em 1900 (não bissexto)"], [10, 5, 1899, "ano 1899"], [10, 5, 2101, "ano 2101"],
]) {
  await expectError("recusa " + why, () => setBirth(U.A, d, m, y), /clients_birthday_valid|check constraint/i);
}
await expectError("recusa dia sem mês", () => as(U.A, () => db.query("update public.clients set birth_day = 10, birth_month = null, birth_year = null where id = $1", [C1])), /check constraint/i);
await expectError("recusa mês sem dia", () => as(U.A, () => db.query("update public.clients set birth_day = null, birth_month = 10, birth_year = null where id = $1", [C1])), /check constraint/i);
await expectError("recusa só o ano", () => as(U.A, () => db.query("update public.clients set birth_day = null, birth_month = null, birth_year = 1990 where id = $1", [C1])), /check constraint/i);
await setBirth(U.A, 29, 2, 2024);
record("29/02/2024 (bissexto) é aceito", (await birth()).y === 2024);
await expectError("anon não altera aniversário", () => as(null, () => db.query("update public.clients set birth_day = 1, birth_month = 1 where id = $1", [C1])), /permission denied/i);
await expectError("D (outro salão) não altera aniversário de cliente do salão 1", async () => {
  const r = await as(U.D, () => db.query("update public.clients set birth_day = 1, birth_month = 1 where id = $1", [C1]));
  if (r.affectedRows === 0) throw new Error("0 linhas afetadas");
}, /0 linhas/);
await db.query("update public.clients set birth_day = null, birth_month = null, birth_year = null where id = $1", [C1]);
const created = await as(U.A, () => db.query("insert into public.clients (salon_id, full_name, phone, created_by, birth_day, birth_month) values ($1, 'Nova com aniversário', '5511999990077', $2, 7, 9) returning id", [S1, U.A]));
record("cliente pode ser cadastrada já com aniversário", created.rows.length === 1);

// ---- cadastro com código de convite
const signup = (id, meta) => db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, id + "@novo.test", JSON.stringify(meta)]);
const N = (n) => `00000000-0000-0000-0000-0000000001${String(n).padStart(2, "0")}`;
const member = async (id) => (await rows("select p.display_name, m.role, p.salon_id from public.salon_members m join public.professionals p on p.user_id = m.user_id and p.salon_id = m.salon_id where m.user_id = $1", [id]));

await expectError("sem código configurado, cadastro com código é recusado (falha fechada)", () => signup(N(1), { full_name: "Nova Pessoa", invite_code: "qualquer-coisa" }), /invalid_invite_code/);
await expectError("código curto não pode ser definido", () => db.query("select private.set_invite_code('curto')"), /pelo menos 8/);
await db.query("select private.set_invite_code($1)", ["Convite-Teste-123"]);
record("o código é guardado só como hash (nunca em texto puro)",
  (await rows("select code_hash from private.invite_codes"))[0].code_hash.length === 64 &&
  !JSON.stringify(await rows("select * from private.invite_codes")).includes("Convite"));

await expectError("código errado é recusado", () => signup(N(2), { full_name: "Nova Pessoa", invite_code: "errado-errado" }), /invalid_invite_code/);
record("cadastro recusado não deixa conta nem perfil para trás",
  (await rows("select 1 from auth.users where id = $1", [N(2)])).length === 0 && (await rows("select 1 from public.profiles where id = $1", [N(2)])).length === 0);

await signup(N(3), { full_name: "  Maria Souza  ", invite_code: "  convite-TESTE-123 " }); // espaços e maiúsculas não importam
const m3 = await member(N(3));
record("código certo: entra no salão como profissional, com o nome informado (sem espaços nas pontas)",
  m3.length === 1 && m3[0].display_name === "Maria Souza" && m3[0].role === "professional" && m3[0].salon_id === S1, JSON.stringify(m3));
record("a nova conta enxerga os clientes e serviços do salão",
  (await as(N(3), () => rows("select id from public.clients where id = $1", [C1]))).length === 1 &&
  (await as(N(3), () => rows("select id from public.services where id = $1", [SA]))).length === 1);
record("a nova conta NÃO enxerga atendimentos de ninguém (agenda privada)",
  (await as(N(3), () => rows("select id from public.appointments"))).length === 0);
await db.query("update public.appointments set status = status"); // nada muda; garante que a tabela segue íntegra

await expectError("nome em branco é recusado", () => signup(N(4), { full_name: "   ", invite_code: "convite-teste-123" }), /invalid_name/);
await expectError("nome com 1 letra é recusado", () => signup(N(5), { full_name: "A", invite_code: "convite-teste-123" }), /invalid_name/);
await expectError("nome com mais de 60 caracteres é recusado", () => signup(N(6), { full_name: "x".repeat(61), invite_code: "convite-teste-123" }), /invalid_name/);

await signup(N(7), { full_name: "Sem Convite" });
record("sem código: a conta nasce SEM acesso (nem salão nem profissional)", (await member(N(7))).length === 0);
record("sem acesso: não lê clientes, serviços nem atendimentos",
  (await as(N(7), () => rows("select id from public.clients"))).length === 0 &&
  (await as(N(7), () => rows("select id from public.services"))).length === 0 &&
  (await as(N(7), () => rows("select id from public.appointments"))).length === 0);

await expectError("anon não lê a tabela de códigos", () => as(null, () => rows("select * from private.invite_codes")), /permission denied/i);
await expectError("usuária logada não lê a tabela de códigos", () => as(N(3), () => rows("select * from private.invite_codes")), /permission denied/i);
await expectError("usuária logada não troca o código", () => as(N(3), () => rows("select private.set_invite_code('outro-codigo-123')")), /permission denied/i);

await db.query("select private.set_invite_code($1)", ["Outro-Codigo-456"]);
await expectError("depois de trocar o código, o antigo deixa de valer", () => signup(N(8), { full_name: "Antiga Convidada", invite_code: "convite-teste-123" }), /invalid_invite_code/);
await signup(N(9), { full_name: "Nova Convidada", invite_code: "outro-codigo-456" });
record("o código novo vale", (await member(N(9))).length === 1);

// ---- funções privadas não expostas ao anon
await expectError("anon não executa funções do schema private",
  () => as(null, () => rows(`select private.is_salon_member('${S1}')`)), /permission denied/i);

console.log(`\n${passed} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
