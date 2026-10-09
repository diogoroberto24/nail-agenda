import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Perfil" };

export default function Page() {
  return (
    <>
      <PageHeader title="Perfil" description="Seus dados de acesso." backHref="/menu" backLabel="Menu" />
      <EmptyState
        icon={UserRound}
        title="Perfil em preparação"
        description="Aqui você vai atualizar seu nome, e-mail e senha."
      />
    </>
  );
}
