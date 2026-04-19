export type SortDir = 'asc' | 'desc';

export function toggleSort<K extends string>(
  prev: { key: K | null; dir: SortDir },
  column: K
): { key: K | null; dir: SortDir } {
  if (prev.key !== column) return { key: column, dir: 'asc' };
  return { key: column, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
}

export function cmpStr(a: string, b: string, dir: SortDir): number {
  const x = a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
  return dir === 'asc' ? x : -x;
}

export function cmpNum(a: number, b: number, dir: SortDir): number {
  return dir === 'asc' ? a - b : b - a;
}

/** Parse ISO date string for comparison; missing dates sort as 0. */
export function dateMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}
