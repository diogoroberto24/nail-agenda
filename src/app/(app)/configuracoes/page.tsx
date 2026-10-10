import type { Metadata } from "next";
import { Smartphone } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Configurações" };

const STEPS: { title: string; steps: string[] }[] = [
  {
    title: "No Android (Chrome)",
    steps: ["Toque nos três pontinhos no canto do navegador.", "Escolha “Instalar app” ou “Adicionar à tela inicial”.", "Confirme. O ícone aparece na tela inicial."],
  },
  {
    title: "No iPhone (Safari)",
    steps: [
      "Abra este endereço no Safari (não funciona em outros navegadores).",
      "Toque no botão de compartilhar, o quadrado com a seta para cima.",
      "Escolha “Adicionar à Tela de Início” e confirme.",
    ],
  },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" description="Preferências do aplicativo." backHref="/menu" backLabel="Menu" />
      <div className="px-5">
        <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-cocoa">
            <Smartphone className="size-5 text-rose-deep" aria-hidden />
            Instalar no celular
          </h2>
          <p className="text-[0.95rem] text-taupe-soft">
            Instalado, o Nail Agenda abre em tela cheia, como um aplicativo, direto da tela inicial. Você continua entrando com o seu e-mail e a sua senha.
          </p>
          {STEPS.map((block) => (
            <div key={block.title} className="space-y-2">
              <h3 className="text-lg font-semibold text-cocoa">{block.title}</h3>
              <ol className="list-decimal space-y-1 pl-5 text-[0.95rem] text-cocoa marker:text-rose-deep">
                {block.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
