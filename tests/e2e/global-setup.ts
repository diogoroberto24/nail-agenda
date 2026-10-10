import { mkdirSync, writeFileSync } from "node:fs";
import { addDays, toZonedParts, zonedDateTimeToUtc } from "../../src/lib/timezone";
import { AUTH_DIR, FIXTURE_FILE, MARK, adminClient, cleanup, createSessionState, loadEnv, type Fixture } from "./helpers";

/**
 * 1) Cria a sessão da profissional 1 pela API do Supabase (a mesma que o app usaria) e a grava como
 *    cookies do navegador. Assim os testes entram já logados, sem digitar senha em formulário.
 * 2) Prepara dados de exemplo (marcados com __e2e__) para as telas terem conteúdo real.
 */
export default async function globalSetup() {
  loadEnv();
  mkdirSync(AUTH_DIR, { recursive: true });
  await cleanup(); // sobras de uma execução interrompida

  // ---- sessão (mesmos cookies que o app grava ao fazer login)
  const state = await createSessionState(process.env.SEED_PRO1_EMAIL!, process.env.SEED_PRO1_PASSWORD!);
  writeFileSync(`${AUTH_DIR}/pro-a.json`, JSON.stringify(state));

  // ---- dados de exemplo
  const admin = adminClient();
  const { data: pros } = await admin.from("professionals").select("id, salon_id, user_id, display_name").order("created_at");
  const { data: userA } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
  const aUserId = userA.users.find((u) => u.email?.toLowerCase() === process.env.SEED_PRO1_EMAIL!.toLowerCase())!.id;
  const proA = pros!.find((p) => p.user_id === aUserId)!;
  const proB = pros!.find((p) => p.user_id !== aUserId)!;
  const salonId = proA.salon_id;

  const today = toZonedParts(new Date()).date;
  const tomorrow = addDays(today, 1);

  const client = (await admin.from("clients").insert({ salon_id: salonId, full_name: `${MARK} Maria Fixa`, phone: "5511999990001" }).select("id").single()).data!;
  const mkService = async (pro: typeof proA, name: string, minutes: number, price: number) =>
    (await admin.from("services").insert({ salon_id: salonId, professional_id: pro.id, name: `${MARK} ${name}`, default_duration_minutes: minutes, default_price: price }).select("id").single()).data!.id as string;
  const svcA = await mkService(proA, "Esmaltação", 40, 50);
  const svcB = await mkService(proB, "Alongamento", 120, 180);

  const mkAppt = async (pro: typeof proA, svc: string, date: string, time: string, mins: number, status: string) => {
    const start = zonedDateTimeToUtc(date, time);
    const { data } = await admin
      .from("appointments")
      .insert({
        salon_id: salonId, professional_id: pro.id, client_id: client.id, service_id: svc,
        start_at: start.toISOString(), end_at: new Date(start.getTime() + mins * 60_000).toISOString(),
        duration_minutes_at_booking: mins, price_at_booking: 50, status, created_by: aUserId,
      })
      .select("id")
      .single();
    return data!.id as string;
  };

  const fixture: Fixture = {
    salonId,
    proA: { id: proA.id, name: proA.display_name },
    proB: { id: proB.id, name: proB.display_name },
    clientName: `${MARK} Maria Fixa`,
    clientId: client.id,
    today,
    tomorrow,
    appointments: {
      confirmedA: await mkAppt(proA, svcA, tomorrow, "09:00", 40, "confirmed"),
      awaitingA: await mkAppt(proA, svcA, tomorrow, "14:00", 40, "awaiting_confirmation"),
      awaitingB: await mkAppt(proB, svcB, tomorrow, "09:00", 120, "awaiting_confirmation"),
      todayA: await mkAppt(proA, svcA, today, "23:00", 40, "awaiting_confirmation"),
    },
  };
  writeFileSync(FIXTURE_FILE, JSON.stringify(fixture));
}
