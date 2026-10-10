export type RecentClientRow = {
  client_id: string;
  clients: { id: string; full_name: string; phone: string; archived_at: string | null } | null;
};

export type RecentClient = { id: string; fullName: string; phone: string };

/**
 * A partir de atendimentos já ordenados do mais recente para o mais antigo, devolve as últimas clientes
 * DIFERENTES atendidas, sem repetir e sem as arquivadas.
 */
export function pickRecentClients(rows: RecentClientRow[], limit = 4): RecentClient[] {
  const seen = new Set<string>();
  const out: RecentClient[] = [];
  for (const row of rows) {
    const c = row.clients;
    if (!c || c.archived_at || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push({ id: c.id, fullName: c.full_name, phone: c.phone });
    if (out.length === limit) break;
  }
  return out;
}
