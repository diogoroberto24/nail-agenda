"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronRight, Info, Plus, Search, Sparkles } from "lucide-react";
import { useDraft, useStepGuard } from "@/components/appointments/wizard/draft-context";
import { StepFooter } from "@/components/appointments/wizard/step-footer";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/lib/datetime";
import { formatBRL, formatPriceInput } from "@/lib/money";
import { nextHref, type DraftService } from "@/lib/appointments/wizard";
import { useFormIds } from "@/lib/use-form-ids";
import { cn } from "@/lib/utils";

/** A partir de quantos serviços aparece o campo de busca. */
const SEARCH_FROM = 6;

/**
 * Etapa 2: escolher o serviço (só os da própria profissional). Um toque escolhe e já avança.
 * Duração e preço do serviço entram no rascunho; podem ser ajustados na etapa de detalhes.
 */
export function ServiceStep({ services }: { services: DraftService[] }) {
  const id = useFormIds();
  const router = useRouter();
  const { draft, update } = useDraft();
  const ready = useStepGuard("servico");
  const retornoAoResumo = useSearchParams().get("retorno") === "detalhes";
  const [query, setQuery] = useState("");

  if (!ready) return <div className="px-5 text-sm text-taupe-soft">Carregando...</div>;

  const term = query.trim().toLowerCase();
  const visible = term ? services.filter((s) => s.name.toLowerCase().includes(term)) : services;

  function choose(service: DraftService) {
    const sameAsBefore = draft.service?.id === service.id;
    update({
      service,
      // trocar de serviço volta ao padrão dele; escolher o mesmo mantém o que foi ajustado antes
      ...(sameAsBefore ? {} : { durationMinutes: String(service.durationMinutes), price: formatPriceInput(service.price) }),
    });
  }

  function goNext() {
    router.push(nextHref("servico", retornoAoResumo));
  }

  if (services.length === 0) {
    return (
      <div className="px-5">
        <div className="space-y-3 rounded-2xl border border-dashed border-input bg-card px-4 py-6 text-center">
          <p className="text-[0.95rem] text-taupe-soft">Você ainda não tem serviços ativos.</p>
          <Link
            href="/servicos/novo"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cocoa px-4 font-medium text-offwhite"
          >
            <Plus className="size-4" aria-hidden />
            Cadastrar serviço
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-5">
      {services.length >= SEARCH_FROM && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-taupe-soft" aria-hidden />
          <label htmlFor={id("busca")} className="sr-only">
            Buscar serviço
          </label>
          <Input
            id={id("busca")}
            type="search"
            autoComplete="off"
            placeholder="Buscar serviço"
            className="pl-12"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-input bg-card px-4 py-5 text-sm text-taupe-soft">
          Nenhum serviço com esse nome.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((s) => {
            const selected = draft.service?.id === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => choose(s)}
                  className={cn(
                    "flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border px-3 text-left active:bg-muted",
                    selected ? "border-rose bg-nude" : "border-border bg-card",
                  )}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-nude text-rose-deep">
                    <Sparkles className="size-5" strokeWidth={1.6} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[1.05rem] font-medium text-cocoa">{s.name}</span>
                    <span className="block text-sm text-taupe-soft">
                      {formatDuration(s.durationMinutes)} • {formatBRL(s.price)}
                    </span>
                  </span>
                  {selected ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-cocoa text-offwhite">
                      <Check className="size-4" strokeWidth={2.6} aria-hidden />
                      <span className="sr-only">Selecionado</span>
                    </span>
                  ) : (
                    <ChevronRight className="size-5 text-taupe" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-start gap-3 rounded-2xl bg-muted px-4 py-3 text-sm text-taupe-soft">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        Duração e preço são preenchidos automaticamente conforme o serviço selecionado. Você poderá ajustá-los antes de agendar.
      </p>

      <StepFooter canContinue={draft.service !== null} onContinue={goNext} hint="Escolha um serviço para continuar." />
    </div>
  );
}
