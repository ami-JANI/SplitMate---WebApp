const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** ৳1,800 or ৳33.34 */
export const formatTaka = (cents: number) => `৳${formatter.format(cents / 100)}`;

/** Parses "1,250.5" into paisa. Returns undefined when empty, NaN when invalid. */
export function parseTaka(input: string): number | undefined {
  const clean = input.replace(/[,\s৳]/g, '');
  if (clean === '') return undefined;
  if (!/^\d*\.?\d*$/.test(clean) || clean === '.') return NaN;
  return Math.round(parseFloat(clean) * 100);
}
