import { CalendarHeart } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function Home() {
  return (
    <>
      <PageHeader title="Início" description="Sua rotina de hoje, num só lugar." />
      <EmptyState
        icon={CalendarHeart}
        title="Nenhum atendimento por aqui"
        description="Quando houver atendimentos marcados para hoje, eles aparecem nesta tela."
      />
    </>
  );
}
