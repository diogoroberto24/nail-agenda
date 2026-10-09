import { Label } from "@/components/ui/label";

type FieldProps = {
  id: string;
  label: string;
  /** texto de ajuda abaixo do campo */
  hint?: string;
  /** mensagem de erro, mostrada colada ao campo */
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
};

/** Rótulo + campo + dica + erro, com ids ligados para leitores de tela. O input deve usar aria-describedby={`${id}-msg`}. */
export function Field({ id, label, hint, error, optional, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-taupe-soft"> (opcional)</span>}
      </Label>
      {children}
      {(error || hint) && (
        <p id={`${id}-msg`} className={error ? "text-sm text-destructive" : "text-sm text-taupe-soft"}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
