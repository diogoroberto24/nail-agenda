import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { TimeStep } from "@/components/appointments/wizard/time-step";
import { todayInZone } from "@/lib/timezone";

export const metadata: Metadata = { title: "Novo agendamento: data e horário" };

export default function TimeStepPage() {
  return (
    <Suspense fallback={<div className="px-5 text-sm text-taupe-soft">Carregando...</div>}>
      <TimeStepData />
    </Suspense>
  );
}

async function TimeStepData() {
  await connection();
  const now = new Date();
  return <TimeStep today={todayInZone(undefined, now)} nowIso={now.toISOString()} />;
}
