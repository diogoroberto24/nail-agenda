"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronRight, LoaderCircle, Plus, Search, UserRound, X } from "lucide-react";
import { QuickClientForm } from "@/components/appointments/client-picker";
import { useDraft } from "@/components/appointments/wizard/draft-context";
import { StepFooter } from "@/components/appointments/wizard/step-footer";
import { Input } from "@/components/ui/input";
import { searchClientsAction, type PickerClient } from "@/app/(app)/agendamentos/actions";
import { createClientAction } from "@/app/(app)/clientes/actions";
import { nextHref } from "@/lib/appointments/wizard";
import { useFormIds } from "@/lib/use-form-ids";
import { cn } from "@/lib/utils";

const DEFAULT_ACTIONS = { search: searchClientsAction, create: createClientAction };

type ClientStepProps = {
  /** clientes mostradas quando não há busca (as recentes, ou as primeiras em ordem alfabética) */
  initialClients: PickerClient[];
  /** true quando `initialClients` são as recentes; false quando é a lista alfabética de reserva */
  recent: boolean;
  /** permite injetar as ações nos testes */
  actions?: { search: typeof searchClientsAction; create: typeof createClientAction };
};

/**
 * Etapa 1: escolher a cliente. Um toque escolhe e já avança. Busca por nome ou telefone e cadastro rápido.
 */
export function ClientStep({ initialClients, recent, actions = DEFAULT_ACTIONS }: ClientStepProps) {
  const id = useFormIds();
  const router = useRouter();
  const { draft, update } = useDraft();
  const retornoAoResumo = useSearchParams().get("retorno") === "detalhes";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerClient[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [creating, setCreating] = useState(false);

  const term = query.trim();

  // busca depois de uma pausa na digitação
  useEffect(() => {
    if (!term) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setSearching(true);
      try {
        const found = await actions.search(term);
        if (!cancelled) {
          setResults(found);
          setSearchError(false);
        }
      } catch {
        if (!cancelled) setSearchError(true);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, actions]);

  function choose(client: { id: string; name: string; phone: string }) {
    update({ client });
    // fecha o cadastro rápido; a cliente fica marcada e a pessoa segue pelo botão "Continuar"
    setCreating(false);
  }

  function goNext() {
    router.push(nextHref("cliente", retornoAoResumo));
  }

  // sem texto: as clientes iniciais; com texto: o resultado da busca (vazio até a primeira resposta)
  const showingSearch = term.length > 0;
  // a cliente já escolhida (por exemplo, recém-cadastrada) fica no topo, mesmo fora das recentes,
  // para quem volta a esta etapa ver quem está selecionada
  const chosen = draft.client;
  const pinned: PickerClient[] =
    !showingSearch && chosen && !initialClients.some((c) => c.id === chosen.id)
      ? [{ id: chosen.id, fullName: chosen.name, phone: chosen.phone }]
      : [];
  const list: PickerClient[] = showingSearch ? (results ?? []) : [...pinned, ...initialClients];
  const heading = showingSearch ? "Resultados da busca" : recent ? "Clientes recentes" : "Suas clientes";

  if (creating) {
    return (
      <div className="px-5">
        <QuickClientForm
          create={actions.create}
          onCancel={() => setCreating(false)}
          onCreated={(c) => choose(c)}
          onUseExisting={(d) => choose({ id: d.id, name: d.fullName, phone: "" })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-taupe-soft" aria-hidden />
        <label htmlFor={id("busca")} className="sr-only">
          Buscar cliente por nome ou telefone
        </label>
        <Input
          id={id("busca")}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Nome ou telefone"
          className="pl-12 pr-12 [&::-webkit-search-cancel-button]:hidden"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => {
              setQuery("");
              setResults(null);
            }}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-taupe-soft"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <section aria-labelledby={id("lista")} className="space-y-2">
        <h3 id={id("lista")} className="flex items-center gap-2 font-sans text-sm font-medium text-cocoa">
          {heading}
          {searching && (
            <span role="status" className="flex items-center gap-1 text-xs font-normal text-taupe-soft">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              Buscando...
            </span>
          )}
        </h3>

        {searchError && (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível buscar agora. Verifique a conexão.
          </p>
        )}

        {list.length > 0 ? (
          <ul className="space-y-2">
            {list.map((c) => {
              const selected = draft.client?.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => choose({ id: c.id, name: c.fullName, phone: c.phone })}
                    className={cn(
                      "flex min-h-16 w-full items-center gap-3 rounded-2xl border px-3 text-left active:bg-muted",
                      selected ? "border-rose bg-nude" : "border-border bg-card",
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-nude text-rose-deep">
                      <UserRound className="size-5" strokeWidth={1.6} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-cocoa">{c.fullName}</span>
                      <span className="block text-sm text-taupe-soft">{c.phone}</span>
                    </span>
                    {selected ? (
                      <span className="flex size-6 items-center justify-center rounded-full bg-cocoa text-offwhite">
                        <Check className="size-4" strokeWidth={2.6} aria-hidden />
                        <span className="sr-only">Selecionada</span>
                      </span>
                    ) : (
                      <ChevronRight className="size-5 text-taupe" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          !searching &&
          !searchError && (
            <p className="rounded-2xl border border-dashed border-input bg-card px-4 py-5 text-sm text-taupe-soft">
              {showingSearch && results !== null
                ? "Ninguém encontrada com esse nome ou telefone."
                : showingSearch
                  ? "Buscando..."
                  : "Nenhuma cliente cadastrada ainda."}
            </p>
          )
        )}
      </section>

      <button
        type="button"
        onClick={() => setCreating(true)}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-rose bg-nude px-4 font-medium text-cocoa active:opacity-80"
      >
        <Plus className="size-5" aria-hidden />
        Cadastrar nova cliente
      </button>

      <StepFooter canContinue={draft.client !== null} onContinue={goNext} hint="Escolha uma cliente para continuar." />
    </div>
  );
}
