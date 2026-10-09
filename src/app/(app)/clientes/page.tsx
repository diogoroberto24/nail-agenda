import type { Metadata } from "next";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Clientes" };

export default function Page() {
  return (
    <>
      <PageHeader title="Clientes" description="Cadastro compartilhado do salão." />
      <EmptyState
        icon={Users}
        title="Clientes em preparação"
        description="Aqui você vai buscar, cadastrar e consultar o histórico das clientes."
      />
    </>
  );
}
