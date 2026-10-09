import { BottomNav } from "@/components/layout/bottom-nav";
import { NewAppointmentFab } from "@/components/layout/new-appointment-fab";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {/* reserva espaço para a navegação fixa e para o botão flutuante */}
      <main className="mx-auto w-full max-w-2xl flex-1 pb-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+5.5rem)]">
        {children}
      </main>
      <NewAppointmentFab />
      <BottomNav />
    </>
  );
}
