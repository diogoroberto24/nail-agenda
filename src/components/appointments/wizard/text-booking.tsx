"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, LoaderCircle, NotebookPen, Sparkles, TriangleAlert, UserRound, Wand2 } from "lucide-react";
import { useDraft } from "@/components/appointments/wizard/draft-context";
import { StepFooter } from "@/components/appointments/wizard/step-footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { interpretBookingTextAction, type InterpretResult } from "@/app/(app)/agendamentos/novo/texto/actions";
import { BOOKING_TEXT_MAX, type BookingClient, type BookingSuggestion } from "@/lib/ai/booking-types";
import { emptyDraft, firstIncompleteBefore, stepHref } from "@/lib/appointments/wizard";
import { formatPriceInput } from "@/lib/money";
import { formatLongDateCapitalized } from "@/lib/timezone";
import { useFormIds } from "@/lib/use-form-ids";
import { cn } from "@/lib/utils";

const EXAMPLES = ["Ana amanhã 14h pé e mão", "Marca a Beatriz sexta às 9 e meia, manicure", "Carla dia 20 às 16h"];

type TextBookingProps = {
  /** permite injetar a ação nos testes */
  interpret?: (text: string) => Promise<InterpretResult>;
};

/**
 * Agendar por texto (IA): a profissional descreve o atendimento numa frase, a IA sugere cliente,
 * serviço, data e horário, e o rascunho do fluxo é preenchido com o que foi entendido.
 * Nada é gravado aqui: "Revisar e agendar" leva à primeira etapa que ainda falta (ou ao resumo),
 * onde o agendamento é confirmado como sempre.
 */
export function TextBooking({ interpret = interpretBookingTextAction }: TextBookingProps) {
  const id = useFormIds();
  const router = useRouter();
  const { reset, update } = useDraft();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<BookingSuggestion | null>(null);
  const [picked, setPicked] = useState<BookingClient | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await interpret(text);
      if (!result.ok) {
        setSuggestion(null);
        setError(result.error);
        return;
      }
      setSuggestion(result.suggestion);
      setPicked(result.suggestion.client);
    });
  }

  function continueToWizard() {
    if (!suggestion) return;
    const client = picked ? { id: picked.id, name: picked.name, phone: picked.phone } : null;
    const draft = {
      ...emptyDraft("", { client, date: suggestion.date, time: suggestion.time }),
      service: suggestion.service,
    };
    // novo rascunho (tentativa nova) com o que a IA entendeu; a profissional revisa e confirma no fluxo
    reset({ client, date: suggestion.date, time: suggestion.time });
    if (suggestion.service) {
      update({
        service: suggestion.service,
        durationMinutes: String(suggestion.service.durationMinutes),
        price: formatPriceInput(suggestion.service.price),
        notes: suggestion.notes,
      });
    } else if (suggestion.notes) {
      update({ notes: suggestion.notes });
    }
    router.push(firstIncompleteBefore("detalhes", draft) ?? stepHref("detalhes"));
  }

  const understoodSomething =
    suggestion && (picked || suggestion.clientCandidates.length > 0 || suggestion.service || suggestion.date || suggestion.time);

  return (
    <div className="space-y-5 px-5">
      <div className="space-y-2">
        <label htmlFor={id("texto")} className="block font-medium text-cocoa">
          Descreva o agendamento
        </label>
        <Textarea
          id={id("texto")}
          rows={3}
          maxLength={BOOKING_TEXT_MAX}
          placeholder="Ex.: Ana sexta 14h pé e mão"
          className="bg-card text-base"
          value={text}
          disabled={isPending}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap gap-2" aria-label="Exemplos">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              disabled={isPending}
              onClick={() => setText(example)}
              className="min-h-11 rounded-full border border-border bg-card px-3 text-left text-sm text-taupe-soft active:bg-muted"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <Button type="button" size="lg" variant="outline" className="w-full" disabled={isPending || !text.trim()} onClick={submit}>
        {isPending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Wand2 aria-hidden />}
        {isPending ? "Interpretando..." : suggestion ? "Interpretar de novo" : "Interpretar"}
      </Button>

      {error && (
        <p role="alert" className="rounded-xl bg-nude px-4 py-3 text-sm text-cocoa">
          {error}
        </p>
      )}

      {suggestion && (
        <section aria-label="O que a IA entendeu" className="space-y-3" aria-live="polite">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-cocoa">
            <Sparkles className="size-5 text-rose-deep" aria-hidden />
            Entendi assim
          </h2>

          {!understoodSomething && (
            <p className="rounded-xl bg-muted px-4 py-3 text-sm text-cocoa">
              Não consegui identificar o agendamento. Tente citar a cliente, o serviço, o dia e o horário.
            </p>
          )}

          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <Row icon={UserRound} label="Cliente">
              {picked ? (
                <>
                  <span className="block font-medium text-cocoa">{picked.name}</span>
                  <span className="block text-sm text-taupe-soft">{picked.phone}</span>
                </>
              ) : suggestion.clientCandidates.length > 0 ? (
                <span className="block text-sm text-taupe-soft">Encontrei mais de uma. Qual é?</span>
              ) : (
                <Missing>
                  {suggestion.clientQuery ? `Não encontrei "${suggestion.clientQuery}". Você escolhe na próxima etapa.` : "Escolhida na próxima etapa."}
                </Missing>
              )}
              {!suggestion.client && suggestion.clientCandidates.length > 0 && (
                <div role="radiogroup" aria-label="Escolha a cliente" className="mt-2 flex flex-wrap gap-2">
                  {suggestion.clientCandidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={picked?.id === c.id}
                      onClick={() => setPicked(c)}
                      className={cn(
                        "min-h-11 rounded-full border px-3 text-left text-sm",
                        picked?.id === c.id ? "border-rose bg-rose text-cocoa" : "border-border bg-background text-cocoa",
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </Row>

            <Row icon={Sparkles} label="Serviço">
              {suggestion.service ? (
                <span className="block font-medium text-cocoa">{suggestion.service.name}</span>
              ) : (
                <Missing>Escolhido na próxima etapa.</Missing>
              )}
            </Row>

            <Row icon={CalendarClock} label="Data e horário">
              {suggestion.date ? (
                <span className="block font-medium text-cocoa">
                  {formatLongDateCapitalized(suggestion.date)}
                  {suggestion.time ? `, ${suggestion.time}` : ""}
                </span>
              ) : (
                <Missing>{suggestion.time ? `${suggestion.time}, dia escolhido na próxima etapa.` : "Escolhidos na próxima etapa."}</Missing>
              )}
              {suggestion.date && !suggestion.time && <Missing>Horário escolhido na próxima etapa.</Missing>}
            </Row>

            {suggestion.notes && (
              <Row icon={NotebookPen} label="Observações">
                <span className="block text-cocoa">{suggestion.notes}</span>
              </Row>
            )}
          </div>

          {suggestion.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 rounded-xl bg-nude px-4 py-3 text-sm text-cocoa">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-deep" aria-hidden />
              {w}
            </p>
          ))}

          <p className="text-xs text-taupe-soft">Sugestão feita por IA. Nada foi agendado ainda: você revisa e confirma no resumo.</p>
        </section>
      )}

      {suggestion && understoodSomething && (
        <StepFooter canContinue onContinue={continueToWizard} hint="" label="Revisar e agendar" />
      )}
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof UserRound; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-start gap-3 px-4 py-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-rose-deep" aria-hidden />
      <div className="min-w-0 flex-1">
        <span className="block text-xs text-taupe-soft">{label}</span>
        {children}
      </div>
    </div>
  );
}

function Missing({ children }: { children: React.ReactNode }) {
  return <span className="block text-sm text-taupe-soft">{children}</span>;
}
