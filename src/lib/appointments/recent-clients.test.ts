import { describe, expect, it } from "vitest";
import { pickRecentClients, type RecentClientRow } from "./recent-clients";

const row = (id: string, name: string, archived = false): RecentClientRow => ({
  client_id: id,
  clients: { id, full_name: name, phone: "5511999990000", archived_at: archived ? "2026-01-01T00:00:00Z" : null },
});

describe("pickRecentClients", () => {
  it("mantém a ordem recebida (mais recente primeiro)", () => {
    expect(pickRecentClients([row("a", "Ana"), row("b", "Bia"), row("c", "Carla")]).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("não repete a mesma cliente (várias marcações viram uma só)", () => {
    const out = pickRecentClients([row("a", "Ana"), row("a", "Ana"), row("b", "Bia"), row("a", "Ana")]);
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("ignora arquivadas e linhas sem cliente", () => {
    const out = pickRecentClients([row("a", "Ana", true), { client_id: "x", clients: null }, row("b", "Bia")]);
    expect(out.map((c) => c.id)).toEqual(["b"]);
  });

  it("respeita o limite (padrão 4)", () => {
    const rows = ["a", "b", "c", "d", "e", "f"].map((id) => row(id, id.toUpperCase()));
    expect(pickRecentClients(rows)).toHaveLength(4);
    expect(pickRecentClients(rows, 2).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("sem atendimentos, devolve lista vazia (a tela usa a lista alfabética de reserva)", () => {
    expect(pickRecentClients([])).toEqual([]);
  });

  it("devolve nome e telefone como estão guardados", () => {
    expect(pickRecentClients([row("a", "Ana")])[0]).toEqual({ id: "a", fullName: "Ana", phone: "5511999990000" });
  });
});
