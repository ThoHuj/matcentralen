/** Svensk talformatering: decimalkomma och lagom många decimaler. */
export function formatNumber(n: number): string {
  const abs = Math.abs(n);
  const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return String(Number(n.toFixed(decimals))).replace('.', ',');
}

/**
 * Tolkar en mängd som "1,5", "1/2" eller "1 1/2".
 * Tom sträng ger null, något som inte går att tolka ger undefined.
 */
export function parseAmount(input: string): number | null | undefined {
  const text = input.trim().replace(',', '.');
  if (!text) return null;
  const fraction = text.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
  const value = fraction
    ? Number(fraction[1] ?? 0) + Number(fraction[2]) / Number(fraction[3])
    : Number(text);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function portions(n: number): string {
  return `${formatNumber(n)} ${n === 1 ? 'portion' : 'portioner'}`;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Något gick fel.';
}
