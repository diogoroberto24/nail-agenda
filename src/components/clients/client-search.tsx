"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Campo de busca que mantém o termo na URL (?q=). Busca sozinha após uma pausa na digitação. */
export function ClientSearch({ initialQuery, archived }: { initialQuery: string; archived: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function go(term: string) {
    const params = new URLSearchParams();
    if (term.trim()) params.set("q", term.trim());
    if (archived) params.set("arquivadas", "1");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go(next), 350);
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(value);
      }}
      className="relative"
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-taupe-soft" aria-hidden />
      <Input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        aria-label="Buscar cliente por nome ou telefone"
        placeholder="Buscar por nome ou telefone"
        autoComplete="off"
        className="pl-12 pr-12"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => {
            setValue("");
            go("");
          }}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-taupe-soft"
        >
          <X className="size-5" aria-hidden />
        </button>
      )}
    </form>
  );
}
