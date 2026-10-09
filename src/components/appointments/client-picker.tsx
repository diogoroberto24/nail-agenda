"use client";

import { useEffect, useState, useTransition } from "react";
import { LoaderCircle, Search, UserRoundPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchClientsAction, type PickerClient } from "@/app/(app)/agendamentos/actions";
import { createClientAction, type DuplicateClient, type SaveClientResult } from "@/app/(app)/clientes/actions";
import { clientSchema } from "@/lib/clients/schema";
import { formatBrazilPhone, normalizeBrazilPhone } from "@/lib/phone";

export type SelectedClient = { id: string; name: string; phone: string };

type ClientPickerProps = {
  value: SelectedClient | null;
  onChange: (client: SelectedClient | null) => void;
  error?: string;
  /** permite injetar as ações nos testes */
  actions?: { search: typeof searchClientsAction; create: typeof createClientAction };
};

const DEFAULT_ACTIONS = { search: searchClientsAction, create: createClientAction };

/** Escolha da cliente: busca por nome/telefone ou cadastro rápido, sem sair do agendamento. */
export function ClientPicker({
  value,
  onChange,
  error,
  actions = DEFAULT_ACTIONS,
}: ClientPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerClient[] | null>(null);
  const [searchError, setSearchError] = useState(false);
  const [creating, setCreating] = useState(false);

  // busca após uma pausa na digitação; sem texto, mostra as primeiras clientes
  useEffect(() => {
    if (value) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const found = await actions.search(query);
        if (!cancelled) {
          setResults(found);
          setSearchError(false);
        }
      } catch {
        if (!cancelled) setSearchError(true);
      }
    }, query ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, value, actions]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-cocoa">{value.name}</p>
          <p className="text-sm text-taupe-soft">{value.phone}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => onChange(null)}>
          Trocar
        </Button>
      </div>
    );
  }

  if (creating) {
    return (
      <QuickClientForm
        create={actions.create}
        onCancel={() => setCreating(false)}
        onCreated={(c) => {
          setCreating(false);
          onChange(c);
        }}
        onUseExisting={(d) => {
          setCreating(false);
          onChange({ id: d.id, name: d.fullName, phone: "" });
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-taupe-soft" aria-hidden />
        <Input
          type="search"
          inputMode="search"
          autoComplete="off"
          aria-label="Buscar cliente por nome ou telefone"
          placeholder="Buscar por nome ou telefone"
          className="pl-12"
          aria-invalid={error ? true : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {searchError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível buscar agora. Verifique a conexão.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onChange({ id: c.id, name: c.fullName, phone: c.phone })}
                className="flex min-h-14 w-full flex-col justify-center px-4 text-left active:bg-muted"
              >
                <span className="truncate font-medium text-cocoa">{c.fullName}</span>
                <span className="text-sm text-taupe-soft">{c.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {results && results.length === 0 && (
        <p className="text-sm text-taupe-soft">{query ? "Ninguém encontrada com esse nome ou telefone." : "Nenhuma cliente cadastrada ainda."}</p>
      )}

      <Button type="button" variant="outline" className="w-full" onClick={() => setCreating(true)}>
        <UserRoundPlus aria-hidden />
        Cadastrar nova cliente
      </Button>
    </div>
  );
}

function QuickClientForm({
  create,
  onCancel,
  onCreated,
  onUseExisting,
}: {
  create: typeof createClientAction;
  onCancel: () => void;
  onCreated: (client: SelectedClient) => void;
  onUseExisting: (existing: DuplicateClient) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateClient[]>([]);
  const [isPending, startTransition] = useTransition();

  function submit(allowDuplicate: boolean) {
    setFormError(null);
    const parsed = clientSchema.safeParse({ fullName: name, phone });
    if (!parsed.success) {
      const next: { name?: string; phone?: string } = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "fullName") next.name ??= issue.message;
        if (issue.path[0] === "phone") next.phone ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});

    startTransition(async () => {
      let result: SaveClientResult;
      try {
        result = await create(parsed.data, allowDuplicate);
      } catch {
        setFormError("Não foi possível cadastrar. Verifique a conexão e tente de novo.");
        return;
      }
      if (result.ok) {
        const normalized = normalizeBrazilPhone(parsed.data.phone) as string;
        onCreated({ id: result.id, name: parsed.data.fullName, phone: formatBrazilPhone(normalized) });
        return;
      }
      if (result.code === "duplicate") {
        setDuplicates(result.duplicates);
        return;
      }
      setFormError(result.error);
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-cocoa">Nova cliente</p>
        <button type="button" onClick={onCancel} aria-label="Cancelar cadastro" className="flex size-11 items-center justify-center text-taupe-soft">
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {formError && (
        <p role="alert" className="rounded-xl bg-nude px-4 py-3 text-sm text-cocoa">
          {formError}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="quick-name">Nome completo</Label>
        <Input id="quick-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={errors.name ? true : undefined} />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="quick-phone">Telefone com DDD</Label>
        <Input id="quick-phone" type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={errors.phone ? true : undefined} />
        {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
      </div>

      {duplicates.length > 0 && (
        <div role="alert" className="space-y-2 rounded-xl border border-[#e0c9a0] bg-[#f4ead5] p-3 text-sm text-[#6b4e12]">
          <p className="font-medium">Este telefone já está cadastrado.</p>
          {duplicates.map((d) => (
            <Button key={d.id} type="button" variant="outline" className="w-full" onClick={() => onUseExisting(d)}>
              Usar {d.fullName}
              {d.archived ? " (arquivada)" : ""}
            </Button>
          ))}
          <Button type="button" variant="ghost" className="w-full" disabled={isPending} onClick={() => submit(true)}>
            Cadastrar mesmo assim
          </Button>
        </div>
      )}

      <Button type="button" size="lg" className="w-full" disabled={isPending} onClick={() => submit(false)}>
        {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
        {isPending ? "Cadastrando..." : "Cadastrar e escolher"}
      </Button>
    </div>
  );
}
