import { toZonedParts } from "@/lib/timezone";

export type ConfirmationMessageInput = {
  /** nome completo da cliente; a mensagem usa só o primeiro nome */
  clientName: string;
  /** início do atendimento (instante UTC, como vem do banco) */
  startAt: string | Date;
  serviceName: string;
  professionalName: string;
};

/** "Maria Aparecida Silva" → "Maria". Nome vazio vira "cliente" para a mensagem não ficar quebrada. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "cliente";
}

/** "2026-11-10" → "10/11" */
function dayMonth(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

/**
 * Mensagem de confirmação enviada pelo WhatsApp (modelo definido pela usuária).
 * Data em dia/mês e horário em HH:mm, sempre no fuso do salão.
 */
export function buildConfirmationMessage({ clientName, startAt, serviceName, professionalName }: ConfirmationMessageInput): string {
  const { date, time } = toZonedParts(startAt);
  return [
    `Olá ${firstName(clientName)}, tudo bem? 🤍`,
    "",
    "Passando para confirmar seu agendamento!",
    "",
    `📅 Data: ${dayMonth(date)}`,
    `⏰ Horário: ${time}`,
    `💅 Procedimento: ${serviceName}`,
    `Manicure: ${professionalName}`,
    "",
    "Está tudo certinho para você?",
    "",
    "Caso precise cancelar ou remarcar, pedimos que nos avise com antecedência.",
    "",
    "Aguardamos você! Será um prazer te atender.",
  ].join("\n");
}

export type BirthdayMessageInput = {
  /** nome completo da cliente; a mensagem usa só o primeiro nome */
  clientName: string;
  professionalName: string;
};

/** Mensagem de parabéns no dia do aniversário (enviada pelo WhatsApp com um toque). */
export function buildBirthdayMessage({ clientName, professionalName }: BirthdayMessageInput): string {
  return [
    `Olá ${firstName(clientName)}! 🎂💖`,
    "",
    "Hoje é o seu dia e não poderíamos deixar de te desejar um feliz aniversário!",
    "",
    "Que seja um dia lindo, cheio de alegria, saúde e muito carinho.",
    "",
    "Com carinho,",
    `${professionalName} ✨`,
  ].join("\n");
}
