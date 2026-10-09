import { digitsOnly } from "./phone";

/**
 * Link para abrir uma conversa no WhatsApp (app ou web) com a cliente.
 * `phone` deve ser o telefone guardado (55 + DDD + número). A mensagem é opcional e vai codificada na URL.
 * Retorna null se o telefone não tiver o formato esperado.
 */
export function buildWhatsAppUrl(phone: string, message?: string): string | null {
  const digits = digitsOnly(phone);
  if (!/^55\d{10,11}$/.test(digits)) return null;
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
