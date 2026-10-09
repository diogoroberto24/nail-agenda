// Verificação de ponta a ponta contra o Supabase REAL (o do .env.local).
// Entra com as duas contas de teste do seed e confere as regras de segurança.
// Cria dados marcados com "__teste__" e SEMPRE os apaga no final (via chave de administração).
// Uso: npm run test:supabase

import { createClient } from "@supabase/supabase-js";

const env = process.env;
const need = [
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY",
  "SEED_PRO1_EMAIL", "SEED_PRO1_PASSWORD", "SEED_PRO2_EMAIL", "SEED_PRO2_PASSWORD",
];
const missing = need.filter((k) => !env[k]);
if (missing.length) {
  console.error(`Faltam variáveis no .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const mk = (key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = mk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const admin = mk(env.SUPABASE_SECRET_KEY);

let passed = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failures.push(`${name} -> ${detail}`);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + detail}`);
}
const msg = (e) => (e ? `${e.code ?? ""} ${e.message}` : "sem erro");

async function login(email, password) {
  const c = mk(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login falhou (${email}): ${error.message}`);
  return { client: c, userId: data.user.id };
}

const MARK = "__teste__";
const created = { appointments: [], services: [], clients: [] };

try {
  // ---- sem login
  {
    const { data, error } = await anon.from("clients").select("id");
    check("sem login: não lê clientes", Boolean(error) || (data ?? []).length === 0, msg(error));
    const r = await anon.from("appointments").select("id");
    check("sem login: não lê atendimentos", Boolean(r.error) || (r.data ?? []).length === 0, msg(r.error));
  }
  {
    const { error } = await anon.auth.signInWithPassword({ email: env.SEED_PRO1_EMAIL, password: "senha-errada-xyz-123" });
    check("senha errada é recusada", Boolean(error), "entrou com senha errada");
    const s = await anon.auth.signUp({ email: `__teste__${Date.now()}@example.com`, password: "SenhaTeste12345" });
    check("cadastro público está desligado", Boolean(s.error), "signUp foi aceito");
  }

  // ---- com login
  const A = await login(env.SEED_PRO1_EMAIL, env.SEED_PRO1_PASSWORD);
  const B = await login(env.SEED_PRO2_EMAIL, env.SEED_PRO2_PASSWORD);
  check("as duas contas de teste entram", true);

  const claimsA = await A.client.auth.getClaims();
  check("getClaims valida a sessão da A", claimsA.data?.claims?.sub === A.userId, msg(claimsA.error));

  const { data: salons } = await A.client.from("salons").select("id");
  check("A vê exatamente 1 salão", salons?.length === 1, JSON.stringify(salons?.length));
  const salonId = salons[0].id;

  const { data: pros } = await A.client.from("professionals").select("id, user_id, display_name, active");
  check("A vê as 2 profissionais do salão", pros?.length === 2, String(pros?.length));
  const proA = pros.find((p) => p.user_id === A.userId);
  const proB = pros.find((p) => p.user_id === B.userId);
  check("cada conta está ligada à sua profissional", Boolean(proA && proB && proA.id !== proB.id));

  const { data: members } = await B.client.from("salon_members").select("user_id, role");
  check("B vê os 2 membros do salão", members?.length === 2, String(members?.length));
  const { data: profiles } = await A.client.from("profiles").select("id");
  check("trigger criou os profiles (A vê 2)", profiles?.length === 2, String(profiles?.length));

  // ---- clientes (compartilhados)
  const { data: cli, error: cliErr } = await A.client
    .from("clients").insert({ salon_id: salonId, full_name: `${MARK} Cliente`, phone: "5511999990000" })
    .select("id, created_by").single();
  check("A cadastra cliente (created_by = auth.uid())", !cliErr && cli?.created_by === A.userId, msg(cliErr));
  if (cli) created.clients.push(cli.id);
  const seenByB = await B.client.from("clients").select("id").eq("id", cli?.id ?? "");
  check("B enxerga o cliente cadastrado pela A (compartilhado)", seenByB.data?.length === 1, msg(seenByB.error));
  const dup = await B.client.from("clients").insert({ salon_id: salonId, full_name: `${MARK} Dup`, phone: "5511999990000" }).select("id").single();
  if (dup.data) created.clients.push(dup.data.id);
  check("telefone repetido NÃO é bloqueado (a tela avisa)", !dup.error, msg(dup.error));
  const badPhone = await A.client.from("clients").insert({ salon_id: salonId, full_name: `${MARK} X`, phone: "123" });
  check("telefone inválido é recusado", Boolean(badPhone.error), "aceitou");
  const delClient = await A.client.from("clients").delete().eq("id", cli?.id ?? "").select();
  check("A não apaga cliente", Boolean(delClient.error) || (delClient.data ?? []).length === 0, "apagou");
  const archive = await B.client.from("clients").update({ notes: "obs" }).eq("id", cli?.id ?? "").select("id");
  check("B edita cliente compartilhado", archive.data?.length === 1, msg(archive.error));

  // ---- serviços individuais
  const svcA = await A.client.from("services")
    .insert({ salon_id: salonId, professional_id: proA.id, name: `${MARK} Esmaltação`, default_duration_minutes: 40, default_price: 50 })
    .select("id").single();
  check("A cria serviço para si", !svcA.error, msg(svcA.error));
  if (svcA.data) created.services.push(svcA.data.id);
  const svcB = await B.client.from("services")
    .insert({ salon_id: salonId, professional_id: proB.id, name: `${MARK} Alongamento`, default_duration_minutes: 120, default_price: 180 })
    .select("id").single();
  if (svcB.data) created.services.push(svcB.data.id);
  check("B cria serviço para si", !svcB.error, msg(svcB.error));
  const svcWrong = await B.client.from("services")
    .insert({ salon_id: salonId, professional_id: proA.id, name: `${MARK} Intruso`, default_duration_minutes: 30, default_price: 10 }).select("id");
  if (svcWrong.data?.length) created.services.push(svcWrong.data[0].id);
  check("B NÃO cria serviço para a A", Boolean(svcWrong.error), "criou");
  const priceHack = await B.client.from("services").update({ default_price: 1 }).eq("id", svcA.data?.id ?? "").select("id");
  check("B NÃO altera preço do serviço da A", (priceHack.data ?? []).length === 0, "alterou");

  // ---- atendimentos
  const t0 = new Date("2026-11-10T13:00:00Z");
  const mkAppt = (client, pro, svc, start, mins) => client.from("appointments").insert({
    salon_id: salonId, professional_id: pro.id, client_id: cli.id, service_id: svc,
    start_at: start.toISOString(), end_at: new Date(start.getTime() + mins * 60000).toISOString(),
    duration_minutes_at_booking: mins, price_at_booking: 50,
  }).select("id, status, created_by").single();

  const apA = await mkAppt(A.client, proA, svcA.data.id, t0, 40);
  if (apA.data) created.appointments.push(apA.data.id);
  check("A agenda para si (status inicial = aguardando confirmação)",
    !apA.error && apA.data?.status === "awaiting_confirmation" && apA.data?.created_by === A.userId, msg(apA.error));

  const apB = await mkAppt(B.client, proB, svcB.data.id, t0, 120);
  if (apB.data) created.appointments.push(apB.data.id);
  check("B agenda no MESMO horário que A (profissionais diferentes)", !apB.error, msg(apB.error));

  const overlap = await mkAppt(A.client, proA, svcA.data.id, new Date(t0.getTime() + 20 * 60000), 40);
  if (overlap.data) created.appointments.push(overlap.data.id);
  check("sobreposição da MESMA profissional não é bloqueada (só aviso na tela)", !overlap.error, msg(overlap.error));

  const wrongPro = await mkAppt(B.client, proA, svcA.data.id, t0, 40);
  if (wrongPro.data) created.appointments.push(wrongPro.data.id);
  check("B NÃO agenda em nome da A", Boolean(wrongPro.error), "agendou");

  const seeAB = await B.client.from("appointments").select("id").eq("id", apA.data?.id ?? "");
  check("B enxerga o atendimento da A (agenda compartilhada)", seeAB.data?.length === 1, msg(seeAB.error));
  const editAB = await B.client.from("appointments").update({ status: "confirmed" }).eq("id", apA.data?.id ?? "").select("id");
  check("B NÃO altera atendimento da A", (editAB.data ?? []).length === 0, "alterou");
  const editAA = await A.client.from("appointments").update({ status: "confirmed" }).eq("id", apA.data?.id ?? "").select("id, status");
  check("A altera o próprio atendimento", editAA.data?.[0]?.status === "confirmed", msg(editAA.error));
  for (const st of ["completed", "no_show", "cancelled", "awaiting_confirmation"]) {
    const r = await A.client.from("appointments").update({ status: st }).eq("id", apA.data?.id ?? "").select("status");
    check(`status "${st}" é aceito`, r.data?.[0]?.status === st, msg(r.error));
  }
  const badStatus = await A.client.from("appointments").update({ status: "qualquer" }).eq("id", apA.data?.id ?? "");
  check("status inválido é recusado", Boolean(badStatus.error), "aceitou");
  const giveAway = await A.client.from("appointments").update({ professional_id: proB.id }).eq("id", apA.data?.id ?? "").select("id");
  check("A NÃO passa o atendimento para a B", Boolean(giveAway.error) || (giveAway.data ?? []).length === 0, "passou");
  const delAppt = await A.client.from("appointments").delete().eq("id", apA.data?.id ?? "").select();
  check("A não apaga atendimento (só cancela)", Boolean(delAppt.error) || (delAppt.data ?? []).length === 0, "apagou");

  // histórico congelado
  await admin.from("services").update({ default_price: 99, default_duration_minutes: 90 }).eq("id", svcA.data.id);
  const frozen = await A.client.from("appointments").select("price_at_booking, duration_minutes_at_booking").eq("id", apA.data.id).single();
  check("histórico preservado ao mudar o serviço", Number(frozen.data?.price_at_booking) === 50 && frozen.data?.duration_minutes_at_booking === 40, JSON.stringify(frozen.data));

  // ---- permissões administrativas
  const member = await A.client.from("salon_members").insert({ salon_id: salonId, user_id: B.userId });
  check("A não mexe em membros do salão", Boolean(member.error), "inseriu");
  const newSalon = await A.client.from("salons").insert({ name: "x" });
  check("A não cria salão", Boolean(newSalon.error), "criou");
  const bPro = await A.client.from("professionals").update({ display_name: "hack" }).eq("id", proB.id).select("id");
  check("A não renomeia a B", (bPro.data ?? []).length === 0 || Boolean(bPro.error), "renomeou");

  // ---- expediente e bloqueios
  const bh = await A.client.from("business_hours").insert({ salon_id: salonId, professional_id: proA.id, weekday: 1, start_time: "09:00", end_time: "12:00" }).select("id").single();
  check("A cadastra o próprio expediente", !bh.error, msg(bh.error));
  const bhWrong = await A.client.from("business_hours").insert({ salon_id: salonId, professional_id: proB.id, weekday: 1, start_time: "09:00", end_time: "12:00" });
  check("A NÃO define o expediente da B", Boolean(bhWrong.error), "definiu");
  const bhBad = await A.client.from("business_hours").insert({ salon_id: salonId, professional_id: proA.id, weekday: 2, start_time: "18:00", end_time: "09:00" });
  check("horário final antes do inicial é recusado", Boolean(bhBad.error), "aceitou");
  if (bh.data) await A.client.from("business_hours").delete().eq("id", bh.data.id);
} catch (e) {
  failures.push(`ERRO INESPERADO: ${e.message}`);
  console.log(`ERRO INESPERADO: ${e.message}`);
} finally {
  // limpeza com a chave de administração (ordem respeita as chaves estrangeiras)
  const del = async (table, ids) => ids.length && (await admin.from(table).delete().in("id", ids));
  await del("appointments", created.appointments);
  await del("services", created.services);
  await del("clients", created.clients);
  // garante que nada marcado ficou para trás
  const left = await admin.from("clients").select("id").like("full_name", `${MARK}%`);
  if (left.data?.length) {
    await admin.from("appointments").delete().in("client_id", left.data.map((c) => c.id));
    await admin.from("clients").delete().in("id", left.data.map((c) => c.id));
  }
  const leftSvc = await admin.from("services").select("id").like("name", `${MARK}%`);
  if (leftSvc.data?.length) await admin.from("services").delete().in("id", leftSvc.data.map((s) => s.id));
  console.log("limpeza dos dados de teste concluída.");
}

console.log(`\n${passed} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
