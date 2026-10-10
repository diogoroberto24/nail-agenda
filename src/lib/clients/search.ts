import { digitsOnly } from "@/lib/phone";

/**
 * Monta o filtro `or` (PostgREST) da busca de clientes por nome ou telefone.
 *
 * - Caracteres que fariam parte da sintaxe do filtro (vírgula, parênteses, asterisco, aspas e barra
 *   invertida) viram espaço, para o texto digitado nunca virar um filtro diferente do pretendido.
 * - `%` e `_` são curingas do LIKE: são ESCAPADOS (`\%`, `\_`), então buscar "Ana_Maria" procura
 *   exatamente esse texto.
 * - Telefone só entra na busca quando há pelo menos 3 dígitos.
 * Devolve null se não sobrar nada para buscar.
 */
export function buildClientSearchFilter(q: string): string | null {
  const term = q.replace(/[,()*"\\]/g, " ").replace(/\s+/g, " ").trim();
  if (!term) return null;

  const likeSafe = term.replace(/[%_]/g, (c) => `\\${c}`);
  const filters = [`full_name.ilike.*${likeSafe}*`];
  const digits = digitsOnly(term);
  if (digits.length >= 3) filters.push(`phone.ilike.*${digits}*`);
  return filters.join(",");
}
