import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

type WhatsAppLinkProps = {
  phone: string;
  /** nome da cliente, usado no texto lido por leitores de tela */
  name: string;
  /** mensagem pré-preenchida (opcional) */
  message?: string;
  /** "icon": botão redondo; "button": botão largo com texto */
  variant?: "icon" | "button";
  className?: string;
};

/** Abre uma conversa no WhatsApp (app ou web). Não altera nenhum status. Se o telefone for inválido, não mostra o link. */
export function WhatsAppLink({ phone, name, message, variant = "icon", className }: WhatsAppLinkProps) {
  const href = buildWhatsAppUrl(phone, message);
  if (!href) {
    return (
      <span
        role="note"
        className={cn("flex size-11 items-center justify-center text-xs text-destructive", className)}
        title="Telefone inválido"
      >
        Tel. inválido
      </span>
    );
  }

  if (variant === "button") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#e4ede5] px-4 text-[0.95rem] font-medium text-[#2f5a3a] active:opacity-80",
          className,
        )}
      >
        <MessageCircle className="size-5" aria-hidden />
        Abrir WhatsApp
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Abrir WhatsApp de ${name}`}
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-full text-[#2f5a3a] active:bg-[#e4ede5]",
        className,
      )}
    >
      <MessageCircle className="size-6" strokeWidth={1.7} aria-hidden />
    </a>
  );
}
