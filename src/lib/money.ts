const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const MAX_PRICE = 99999.99;

/**
 * Lê um valor em reais digitado à brasileira: "50", "50,5", "1.234,56", "R$ 50,00".
 * Retorna o valor com 2 casas, ou null se não for um número válido.
 */
export function parsePrice(input: string): number | null {
  const cleaned = input.replace(/R\$/gi, "").replace(/\s/g, "");
  if (cleaned === "") return null;

  // formato brasileiro: milhar com ponto, decimal com vírgula
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(cleaned)) return null;

  const value = Number(cleaned.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

/** 50 → "R$ 50,00" */
export function formatBRL(value: number | string): string {
  return BRL.format(Number(value));
}

/** 50 → "50,00" (para preencher campos de edição) */
export function formatPriceInput(value: number | string): string {
  return Number(value).toFixed(2).replace(".", ",");
}
