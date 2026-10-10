import Link from "next/link";
import { agendaHref } from "@/lib/agenda-url";
import { addDays, formatShortWeekday, startOfWeek } from "@/lib/timezone";
import { cn } from "@/lib/utils";

type WeekStripProps = {
  date: string;
  today: string;
  pro: string;
  /** atendimentos por data local (YYYY-MM-DD) na semana */
  counts: Record<string, number>;
};

/** Semana compacta (segunda a domingo): 7 alvos de toque de pelo menos 44 px, cada um com a contagem escrita. Em telas muito estreitas rola um pouco na horizontal. Complementa a lista do dia. */
export function WeekStrip({ date, today, pro, counts }: WeekStripProps) {
  const first = startOfWeek(date, 1);
  const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));

  return (
    <nav
      aria-label="Semana"
      className="-mx-2 grid grid-cols-[repeat(7,minmax(2.75rem,1fr))] gap-0.5 overflow-x-auto px-2 pb-1"
    >
      {days.map((day) => {
        const selected = day === date;
        const count = counts[day] ?? 0;
        return (
          <Link
            key={day}
            href={agendaHref({ date: day, pro })}
            aria-current={selected ? "date" : undefined}
            aria-label={`${formatShortWeekday(day)}, dia ${Number(day.slice(8))}, ${count === 0 ? "sem atendimentos" : count === 1 ? "1 atendimento" : `${count} atendimentos`}`}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl text-xs",
              selected ? "bg-cocoa text-offwhite" : "bg-card text-cocoa",
              !selected && day === today && "ring-1 ring-rose",
            )}
          >
            <span className={cn("capitalize", selected ? "text-offwhite/80" : "text-taupe-soft")}>{formatShortWeekday(day)}</span>
            <span className="text-base font-semibold tabular-nums">{Number(day.slice(8))}</span>
            <span className={cn("tabular-nums", count === 0 && "opacity-40")}>{count === 0 ? "–" : count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
