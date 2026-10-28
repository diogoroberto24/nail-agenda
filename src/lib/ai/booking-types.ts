import type { DraftService } from "@/lib/appointments/wizard";

/**
 * Tipos e limites do agendamento por texto que a tela também usa.
 * Ficam separados de `booking.ts` para a tela não carregar o SDK de IA no navegador.
 */
export const BOOKING_TEXT_MAX = 300;

export type BookingClient = { id: string; name: string; phone: string };

export type BookingSuggestion = {
  client: BookingClient | null;
  /** quando a cliente não ficou definida: opções encontradas para a profissional escolher */
  clientCandidates: BookingClient[];
  /** nome citado, para mostrar "não encontrei 'Fulana'" */
  clientQuery: string | null;
  service: DraftService | null;
  /** "" quando não foi entendida */
  date: string;
  time: string;
  notes: string;
  warnings: string[];
};
