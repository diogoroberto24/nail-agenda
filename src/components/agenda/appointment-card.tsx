import Link from "next/link";
import { CalendarClock, Pencil, TriangleAlert } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { formatTime } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { AppointmentItem } from "@/lib/data/appointments";

type AppointmentCardProps = {
  item: AppointmentItem;
  /** o atendimento é da profissional logada e ainda pode ser editado */
  canEdit: boolean;
  /** há outro atendimento da mesma profissional no mesmo horário */
  overlaps: boolean;
  highlighted: boolean;
};

export function AppointmentCard({ item, canEdit, overlaps, highlighted }: AppointmentCardProps) {
  const clientName = item.clients?.full_name ?? "Cliente";
  return (
    <li
      id={`atendimento-${item.id}`}
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-soft",
        highlighted ? "border-rose ring-2 ring-rose/40" : "border-border",
      )}
    >
      <div className="flex items-stretch">
        <Link href={`/agendamentos/${item.id}`} className="min-w-0 flex-1 space-y-1 p-4 active:bg-muted">
          <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5 font-semibold tabular-nums text-cocoa">
              <CalendarClock className="size-4 text-rose-deep" aria-hidden />
              {formatTime(item.start_at)} – {formatTime(item.end_at)}
            </span>
            <StatusBadge status={item.status} />
          </span>
          <span className="block truncate text-lg font-medium text-cocoa">{clientName}</span>
          <span className="block truncate text-sm text-taupe-soft">
            {item.services?.name ?? "Serviço"} · {item.professionals?.display_name ?? "Profissional"}
          </span>
          {overlaps && (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#f4ead5] px-2.5 py-1 text-xs font-medium text-[#6b4e12]">
              <TriangleAlert className="size-3.5" aria-hidden />
              Horário sobreposto
            </span>
          )}
        </Link>

        <div className="flex shrink-0 flex-col divide-y divide-border border-l border-border">
          {item.clients && <WhatsAppLink phone={item.clients.phone} name={clientName} className="flex-1" />}
          {canEdit && (
            <Link
              href={`/agendamentos/${item.id}/editar`}
              aria-label={`Editar atendimento de ${clientName}`}
              className="flex min-h-12 w-12 flex-1 items-center justify-center text-taupe-soft active:bg-muted"
            >
              <Pencil className="size-5" strokeWidth={1.7} aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
