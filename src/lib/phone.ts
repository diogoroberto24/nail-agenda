/**
 * Telefones brasileiros. No banco o telefone é guardado só com dígitos, com DDI:
 * 55 + DDD (2) + número (8 ou 9 dígitos) = 12 ou 13 dígitos.
 */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Converte o que a pessoa digitou em "55DDNNNNNNNNN", ou null se não for um telefone válido.
 * Aceita "(11) 99999-9999", "11999999999", "+55 11 99999-9999", "011 99999-9999" etc.
 */
export function normalizeBrazilPhone(raw: string): string | null {
  let digits = digitsOnly(raw);

  // prefixo de operadora/zero à esquerda (ex.: 011...)
  digits = digits.replace(/^0+/, "");

  // com DDI: 55 + 10 ou 11 dígitos
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  if (digits.length !== 10 && digits.length !== 11) return null;

  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;

  const number = digits.slice(2);
  // celular (9 dígitos) começa com 9; fixo (8 dígitos) começa com 2 a 5
  if (number.length === 9 && number[0] !== "9") return null;
  if (number.length === 8 && !/[2-5]/.test(number[0])) return null;

  return `55${digits}`;
}

/** "5511999998888" → "(11) 99999-8888". Se não reconhecer o formato, devolve o texto original. */
export function formatBrazilPhone(stored: string): string {
  const digits = digitsOnly(stored);
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return stored;
}
