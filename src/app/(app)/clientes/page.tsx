import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Plus, SearchX, UserRoundPlus, Users } from "lucide-react";
import { ClientSearch } from "@/components/clients/client-search";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { buttonVariants } from "@/components/ui/button";
import { listClients } from "@/lib/data/clients";
import { formatBrazilPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Clientes" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ClientsPage({ searchParams }: PageProps<"/clientes">) {
  return (
    <>
      <PageHeader title="Clientes" description="Cadastro compartilhado do salão." />
      <div className="space-y-4 px-5">
        <Link href="/clientes/novo" className={buttonVariants({ size: "lg", className: "w-full" })}>
          <Plus aria-hidden />
          Nova cliente
        </Link>
        {/* a busca lê a URL no request; fica atrás de Suspense por causa do Cache Components */}
        <Suspense fallback={<div className="h-12 rounded-xl bg-muted" />}>
          <SearchAndList searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function SearchAndList({ searchParams }: { searchParams: PageProps<"/clientes">["searchParams"] }) {
  const params = await searchParams;
  const q = (first(params.q) ?? "").slice(0, 80);
  const archived = first(params.arquivadas) === "1";
  const clients = await listClients({ q, archived });

  return (
    <>
      <ClientSearch initialQuery={q} archived={archived} />

      <div className="flex items-center justify-between text-sm text-taupe-soft">
        <span>
          {clients.length === 0 ? "Nenhuma cliente" : clients.length === 1 ? "1 cliente" : `${clients.length} clientes`}
          {archived ? " arquivadas" : ""}
        </span>
        <Link
          href={archived ? (q ? `/clientes?q=${encodeURIComponent(q)}` : "/clientes") : `/clientes?${q ? `q=${encodeURIComponent(q)}&` : ""}arquivadas=1`}
          className="inline-flex min-h-11 items-center font-medium text-rose-deep"
        >
          {archived ? "Ver clientes ativas" : "Ver arquivadas"}
        </Link>
      </div>

      {clients.length === 0 ? (
        q ? (
          <div className="-mx-5">
            <EmptyState icon={SearchX} title="Ninguém encontrada" description="Confira o nome ou o telefone digitado.">
              <Link href="/clientes/novo" className={buttonVariants({ variant: "outline" })}>
                Cadastrar nova cliente
              </Link>
            </EmptyState>
          </div>
        ) : archived ? (
          <div className="-mx-5">
            <EmptyState icon={Users} title="Nenhuma cliente arquivada" description="Clientes arquivadas aparecem aqui." />
          </div>
        ) : (
          <div className="-mx-5">
            <EmptyState
              icon={UserRoundPlus}
              title="Cadastre sua primeira cliente"
              description="Com o cadastro pronto, marcar atendimentos fica rápido."
            >
              <Link href="/clientes/novo" className={buttonVariants()}>
                Cadastrar cliente
              </Link>
            </EmptyState>
          </div>
        )
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {clients.map((c) => (
            <li key={c.id} className="flex items-center pr-2">
              <Link href={`/clientes/${c.id}`} className="min-w-0 flex-1 px-4 py-3 active:bg-muted">
                <span className="block truncate font-medium text-cocoa">{c.full_name}</span>
                <span className="block text-sm text-taupe-soft">{formatBrazilPhone(c.phone)}</span>
              </Link>
              <WhatsAppLink phone={c.phone} name={c.full_name} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
