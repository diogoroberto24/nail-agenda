import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** quando informado, mostra um botão de voltar para essa rota */
  backHref?: string;
  backLabel?: string;
};

export function PageHeader({ title, description, backHref, backLabel = "Voltar" }: PageHeaderProps) {
  return (
    <header className="pt-safe px-5 pb-4 pt-6">
      {backHref && (
        <Link
          href={backHref}
          className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-medium text-taupe-soft"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {backLabel}
        </Link>
      )}
      <h1 className="text-[2rem] font-semibold leading-tight text-cocoa">{title}</h1>
      {description && <p className="mt-1 text-[0.95rem] text-taupe-soft">{description}</p>}
    </header>
  );
}
