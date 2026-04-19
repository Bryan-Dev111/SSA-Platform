/** USD display for hourly rates and labor amounts (product standard: US Dollar). */
export function formatUsd(amount: number | null | undefined, emptyDisplay = '—'): string {
  if (amount == null || !Number.isFinite(Number(amount))) return emptyDisplay;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount));
}
