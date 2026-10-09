import { Ban, CheckCheck, CircleCheck, Clock3, UserX, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type AppointmentStatus } from "@/lib/appointments/status";

/** Texto + ícone + cor: o status nunca depende só da cor para ser entendido. */
const STYLE: Record<AppointmentStatus, { icon: LucideIcon; className: string }> = {
  awaiting_confirmation: { icon: Clock3, className: "bg-[#f4ead5] text-[#6b4e12]" },
  confirmed: { icon: CircleCheck, className: "bg-[#e4ede5] text-[#2f5a3a]" },
  completed: { icon: CheckCheck, className: "bg-nude text-cocoa" },
  cancelled: { icon: Ban, className: "bg-[#efedeb] text-taupe-soft" },
  no_show: { icon: UserX, className: "bg-[#f3dedc] text-[#8a2f2a]" },
};

export function StatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  const { icon: Icon, className: tone } = STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
