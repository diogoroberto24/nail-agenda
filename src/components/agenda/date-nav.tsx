"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { agendaHref } from "@/lib/agenda-url";
import { addDays, formatLongDateCapitalized, isValidDateString } from "@/lib/timezone";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DateNavProps = {
  date: string;
  today: string;
  pro: string;
};

/** Data selecionada, dia anterior/seguinte, "Hoje" e seletor de data nativo (bom no celular). */
export function DateNav({ date, today, pro }: DateNavProps) {
  const router = useRouter();
  const isToday = date === today;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link
          href={agendaHref({ date: addDays(date, -1), pro })}
          aria-label="Dia anterior"
          className={buttonVariants({ variant: "outline", size: "icon" })}
        >
          <ChevronLeft aria-hidden />
        </Link>
        <h2 className="min-w-0 flex-1 text-center text-xl font-semibold leading-tight text-cocoa">
          {formatLongDateCapitalized(date)}
        </h2>
        <Link
          href={agendaHref({ date: addDays(date, 1), pro })}
          aria-label="Próximo dia"
          className={buttonVariants({ variant: "outline", size: "icon" })}
        >
          <ChevronRight aria-hidden />
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={agendaHref({ date: today, pro })}
          aria-current={isToday ? "date" : undefined}
          className={cn(buttonVariants({ variant: isToday ? "secondary" : "outline" }), "flex-1")}
        >
          Hoje
        </Link>
        <label className="sr-only" htmlFor="agenda-date">
          Ir para uma data
        </label>
        <input
          id="agenda-date"
          type="date"
          value={date}
          onChange={(e) => {
            if (isValidDateString(e.target.value)) router.replace(agendaHref({ date: e.target.value, pro }));
          }}
          className="h-11 flex-1 rounded-xl border border-input bg-card px-3 text-base text-cocoa"
        />
      </div>
    </div>
  );
}
