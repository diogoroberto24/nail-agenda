"use client";

import { ChevronRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type StepFooterProps = {
  /** o botão só funciona quando há uma escolha feita */
  canContinue: boolean;
  onContinue: () => void;
  /** texto que explica o que falta, mostrado enquanto o botão está desativado */
  hint: string;
  label?: string;
  /** salvando: desativa o botão e troca o texto */
  pending?: boolean;
};

/**
 * Rodapé fixo das etapas, logo acima da barra de navegação, com o botão "Continuar".
 * O espaço reservado no fim do conteúdo (aria-hidden) impede que o rodapé cubra o último item.
 */
export function StepFooter({ canContinue, onContinue, hint, label = "Continuar", pending = false }: StepFooterProps) {
  return (
    <>
      <div aria-hidden className="h-28" />
      <div
        data-wizard-footer
        className="fixed inset-x-0 z-30 border-t border-border bg-background/95 px-5 pb-3 pt-2 backdrop-blur"
        style={{ bottom: "calc(var(--spacing-nav) + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-2xl space-y-1.5">
          <p className="min-h-5 text-center text-sm text-taupe-soft" aria-live="polite">
            {canContinue ? "" : hint}
          </p>
          <Button type="button" size="lg" className="w-full" disabled={!canContinue || pending} onClick={onContinue}>
            {pending ? "Salvando..." : label}
            {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <ChevronRight aria-hidden />}
          </Button>
        </div>
      </div>
    </>
  );
}
