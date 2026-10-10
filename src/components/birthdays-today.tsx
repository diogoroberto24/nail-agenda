import { Cake } from "lucide-react";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { turningAge } from "@/lib/clients/birthday";
import { formatBrazilPhone } from "@/lib/phone";
import { buildBirthdayMessage } from "@/lib/whatsapp-message";

export type BirthdayPerson = { id: string; full_name: string; phone: string; birth_year: number | null };

/**
 * "Aniversariantes de hoje": cada cliente com um botão que abre o WhatsApp com os parabéns prontos.
 * O envio é com um toque (como a confirmação de agendamento); abrir o WhatsApp não registra nada.
 */
export function BirthdaysToday({ people, today, professionalName }: { people: BirthdayPerson[]; today: string; professionalName: string }) {
  if (people.length === 0) return null;
  return (
    <section aria-labelledby="aniversariantes" className="space-y-3">
      <h2 id="aniversariantes" className="flex items-center gap-2 text-2xl font-semibold text-cocoa">
        <Cake className="size-5 text-rose-deep" aria-hidden />
        Aniversariantes de hoje
      </h2>
      <ul className="space-y-3">
        {people.map((p) => {
          const age = turningAge(p.birth_year, today);
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-medium text-cocoa">{p.full_name}</p>
                <p className="truncate text-sm text-taupe-soft">
                  {formatBrazilPhone(p.phone)}
                  {age ? ` · faz ${age} anos` : ""}
                </p>
              </div>
              <WhatsAppLink
                phone={p.phone}
                name={p.full_name}
                message={buildBirthdayMessage({ clientName: p.full_name, professionalName })}
                variant="button"
                label="Enviar parabéns"
                className="shrink-0"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
