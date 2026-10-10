import { describe, expect, it } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { DraftProvider, useDraft } from "./draft-context";
import { DraftProbe, readDraft } from "./wizard-test-utils";

const wrapper = ({ children }: { children: React.ReactNode }) => <DraftProvider>{children}</DraftProvider>;

describe("DraftProvider", () => {
  it("começa vazio, com um identificador de tentativa", () => {
    const { result } = renderHook(() => useDraft(), { wrapper });
    expect(result.current.draft).toMatchObject({ client: null, service: null, date: "", time: "", notes: "" });
    expect(result.current.draft.attemptId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("update altera só os campos informados", () => {
    const { result } = renderHook(() => useDraft(), { wrapper });
    act(() => result.current.update({ notes: "obs" }));
    act(() => result.current.update({ date: "2026-11-10" }));
    expect(result.current.draft).toMatchObject({ notes: "obs", date: "2026-11-10", client: null });
  });

  it("reset começa um agendamento NOVO: limpa tudo e troca o identificador da tentativa", () => {
    const { result } = renderHook(() => useDraft(), { wrapper });
    const first = result.current.draft.attemptId;
    act(() => result.current.update({ notes: "obs", price: "50,00" }));
    act(() => result.current.reset({ date: "2026-12-01", time: "09:00" }));
    expect(result.current.draft).toMatchObject({ notes: "", price: "", date: "2026-12-01", time: "09:00" });
    expect(result.current.draft.attemptId).not.toBe(first);
  });

  it("o rascunho persiste enquanto o provedor continua montado (entre uma etapa e outra)", () => {
    function Writer() {
      const { update } = useDraft();
      return <button onClick={() => update({ notes: "guardado" })}>gravar</button>;
    }
    const { rerender } = render(
      <DraftProvider>
        <Writer />
        <DraftProbe />
      </DraftProvider>,
    );
    act(() => screen.getByText("gravar").click());
    rerender(
      <DraftProvider>
        <Writer />
        <DraftProbe />
      </DraftProvider>,
    );
    expect(readDraft(screen.getByTestId("draft")).notes).toBe("guardado");
  });

  it("usar o rascunho fora do provedor é um erro claro", () => {
    expect(() => renderHook(() => useDraft())).toThrow(/DraftProvider/);
  });
});
