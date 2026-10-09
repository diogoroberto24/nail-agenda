import Link from "next/link";
import { agendaHref } from "@/lib/agenda-url";
import { cn } from "@/lib/utils";

type ProfessionalFilterProps = {
  date: string;
  selected: string; // "todas" ou id da profissional
  professionals: { id: string; name: string; isMe: boolean }[];
};

/** Alterna entre a agenda de todas e a de cada profissional. Usa o nome escrito, não só cor. */
export function ProfessionalFilter({ date, selected, professionals }: ProfessionalFilterProps) {
  const options = [
    { value: "todas", label: "Todas" },
    ...professionals.map((p) => ({ value: p.id, label: p.isMe ? `${p.name} (você)` : p.name })),
  ];
  return (
    <nav aria-label="Filtrar por profissional" className="flex gap-2 overflow-x-auto pb-1">
      {options.map((o) => {
        const active = o.value === selected;
        return (
          <Link
            key={o.value}
            href={agendaHref({ date, pro: o.value })}
            aria-current={active ? "true" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium",
              active ? "border-cocoa bg-cocoa text-offwhite" : "border-input bg-card text-cocoa",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
