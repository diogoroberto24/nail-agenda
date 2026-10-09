import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleCheck, Plus, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ServiceActiveToggle } from "@/components/services/service-active-toggle";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfessional } from "@/lib/auth/session";
import { listServicesOf } from "@/lib/data/services";
import { formatDuration } from "@/lib/datetime";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Serviços" };

export default function ServicesPage({ searchParams }: PageProps<"/servicos">) {
  return (
    <>
      <PageHeader title="Serviços" description="Seus serviços, preços e durações." backHref="/menu" backLabel="Menu" />
      <div className="space-y-4 px-5">
        <Link href="/servicos/novo" className={buttonVariants({ size: "lg", className: "w-full" })}>
          <Plus aria-hidden />
          Novo serviço
        </Link>
        <Suspense fallback={<div className="h-24 rounded-2xl bg-muted" />}>
          <ServiceList searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function ServiceList({ searchParams }: { searchParams: PageProps<"/servicos">["searchParams"] }) {
  const me = await getCurrentProfessional();
  if (!me) redirect("/auth/acesso-negado");
  const saved = (await searchParams).salvo === "1";
  const services = await listServicesOf(me.professionalId);

  return (
    <>
      {saved && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-[#e4ede5] px-4 py-3 text-sm font-medium text-[#2f5a3a]">
          <CircleCheck className="size-4" aria-hidden />
          Serviço salvo.
        </p>
      )}

      {services.length === 0 ? (
        <div className="-mx-5">
          <EmptyState
            icon={Sparkles}
            title="Cadastre seu primeiro serviço"
            description="Defina nome, duração e preço. Na hora de agendar, os dados já vêm preenchidos."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {services.map((s) => (
            <li key={s.id} className="flex items-center pr-2">
              <Link
                href={`/servicos/${s.id}/editar`}
                className={cn("min-w-0 flex-1 px-4 py-3 active:bg-muted", !s.active && "opacity-60")}
              >
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium text-cocoa">{s.name}</span>
                  {!s.active && (
                    <span className="shrink-0 rounded-full bg-[#efedeb] px-2 py-0.5 text-xs font-medium text-taupe-soft">
                      Desativado
                    </span>
                  )}
                </span>
                <span className="block text-sm text-taupe-soft">
                  {formatDuration(s.default_duration_minutes)} · {formatBRL(s.default_price)}
                </span>
                {s.description && <span className="mt-0.5 block truncate text-sm text-taupe-soft">{s.description}</span>}
              </Link>
              <ServiceActiveToggle serviceId={s.id} active={s.active} name={s.name} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
