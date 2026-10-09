import { Suspense } from "react";
import { AuthGate } from "@/components/layout/auth-gate";
import { BottomNav, BottomNavView } from "@/components/layout/bottom-nav";
import { NewAppointmentFab } from "@/components/layout/new-appointment-fab";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {/* reserva espaço para a navegação fixa e para o botão flutuante */}
      <main className="mx-auto w-full max-w-2xl flex-1 pb-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+5.5rem)]">
        {/* a leitura da sessão acontece no request: fica atrás de Suspense (Cache Components) */}
        <Suspense fallback={<div className="p-5 text-sm text-taupe-soft">Carregando...</div>}>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </main>
      {/* usePathname precisa de Suspense em rotas dinâmicas ([id]); o fallback mostra a barra sem item ativo */}
      <Suspense fallback={null}>
        <NewAppointmentFab />
      </Suspense>
      <Suspense fallback={<BottomNavView pathname="" />}>
        <BottomNav />
      </Suspense>
    </>
  );
}
