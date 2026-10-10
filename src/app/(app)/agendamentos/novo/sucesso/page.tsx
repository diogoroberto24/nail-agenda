import type { Metadata } from "next";
import { SuccessScreen } from "@/components/appointments/wizard/success-screen";

export const metadata: Metadata = { title: "Agendamento realizado" };

export default function SuccessPage() {
  return <SuccessScreen />;
}
