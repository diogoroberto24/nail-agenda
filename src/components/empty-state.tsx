import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
};

export function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="mx-5 flex flex-col items-center rounded-2xl border border-dashed border-input bg-card px-6 py-10 text-center shadow-soft">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-nude text-rose-deep">
        <Icon className="size-6" strokeWidth={1.7} aria-hidden />
      </span>
      <h2 className="text-xl font-semibold text-cocoa">{title}</h2>
      <p className="mt-1.5 max-w-xs text-[0.95rem] leading-relaxed text-taupe-soft">{description}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
