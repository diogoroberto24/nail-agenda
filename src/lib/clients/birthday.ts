/**
 * Aniversário da cliente: dia e mês obrigatórios, ano opcional (quase ninguém precisa do ano, e é um dado
 * a menos para proteger). Tudo em "data do salão", sem fuso: aniversário não é um instante.
 */
export type Birthday = { day: number; month: number; year: number | null };

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // fevereiro com 29: vale para ano bissexto

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Lê o que foi digitado: "15/03", "15/03/1990", "15-03", "15.03.1990", "1503" ou "15031990".
 * Devolve null se estiver vazio ou inválido (31/02, mês 13, ano no futuro...).
 */
export function parseBirthday(input: string, thisYear = new Date().getFullYear()): Birthday | null {
  const text = input.trim();
  if (!text) return null;

  let parts: string[];
  if (/[/.\-\s]/.test(text)) {
    parts = text.split(/[/.\-\s]+/).filter(Boolean);
  } else if (/^\d{4}$/.test(text)) {
    parts = [text.slice(0, 2), text.slice(2)];
  } else if (/^\d{8}$/.test(text)) {
    parts = [text.slice(0, 2), text.slice(2, 4), text.slice(4)];
  } else {
    return null;
  }
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  if (month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) return null;

  let year: number | null = null;
  if (parts[2] !== undefined) {
    if (parts[2].length !== 4) return null;
    year = Number(parts[2]);
    if (year < 1900 || year > thisYear) return null;
    if (month === 2 && day === 29 && !isLeapYear(year)) return null;
  }
  return { day, month, year };
}

const two = (n: number) => String(n).padStart(2, "0");

/** "15/03" ou "15/03/1990". */
export function formatBirthday(b: Birthday): string {
  return `${two(b.day)}/${two(b.month)}${b.year ? `/${b.year}` : ""}`;
}

/** Do que está no banco (colunas) para o texto do formulário; vazio se não houver aniversário. */
export function birthdayFromRow(row: { birth_day: number | null; birth_month: number | null; birth_year: number | null }): Birthday | null {
  if (row.birth_day === null || row.birth_month === null) return null;
  return { day: row.birth_day, month: row.birth_month, year: row.birth_year };
}

/** Das colunas do banco para o texto exibido ("" se não houver). */
export function birthdayText(row: { birth_day: number | null; birth_month: number | null; birth_year: number | null }): string {
  const b = birthdayFromRow(row);
  return b ? formatBirthday(b) : "";
}

/** Do formulário para as colunas do banco. Texto vazio vira "sem aniversário". */
export function birthdayToColumns(input: string | undefined): { birth_day: number | null; birth_month: number | null; birth_year: number | null } {
  const b = input ? parseBirthday(input) : null;
  return { birth_day: b?.day ?? null, birth_month: b?.month ?? null, birth_year: b?.year ?? null };
}

/**
 * Pares dia/mês que contam como "aniversário hoje". Em 28/02 de ano NÃO bissexto, quem faz aniversário
 * em 29/02 também é lembrada (senão passaria o ano sem ser lembrada).
 */
export function birthdayPairsFor(today: string): { day: number; month: number }[] {
  const [y, m, d] = today.split("-").map(Number);
  const pairs = [{ day: d, month: m }];
  if (m === 2 && d === 28 && !isLeapYear(y)) pairs.push({ day: 29, month: 2 });
  return pairs;
}

/** O aniversário cai hoje (a data de hoje no formato YYYY-MM-DD)? */
export function isBirthdayToday(row: { birth_day: number | null; birth_month: number | null }, today: string): boolean {
  if (row.birth_day === null || row.birth_month === null) return false;
  return birthdayPairsFor(today).some((p) => p.day === row.birth_day && p.month === row.birth_month);
}

/** Idade que a cliente faz hoje, se o ano de nascimento foi informado. */
export function turningAge(birthYear: number | null, today: string): number | null {
  if (birthYear === null) return null;
  const age = Number(today.slice(0, 4)) - birthYear;
  return age > 0 ? age : null;
}
