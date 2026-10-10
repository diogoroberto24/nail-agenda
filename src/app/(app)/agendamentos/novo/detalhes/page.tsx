import type { Metadata } from "next";
import { DetailsStep } from "@/components/appointments/wizard/details-step";

export const metadata: Metadata = { title: "Novo agendamento: detalhes" };

export default function DetailsStepPage() {
  return <DetailsStep />;
}
