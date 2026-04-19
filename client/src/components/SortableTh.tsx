import type { CSSProperties } from 'react';
import type { SortDir } from '../utils/tableSort';

export function SortableTh({
  label,
  columnKey,
  activeKey,
  dir,
  onSort,
  style,
}: {
  label: string;
  columnKey: string;
  activeKey: string | null;
  dir: SortDir;
  onSort: (key: string) => void;
  style?: CSSProperties;
}) {
  const active = activeKey === columnKey;
  return (
    <th scope="col" style={style}>
      <button
        type="button"
        className="table-sort-header"
        onClick={() => onSort(columnKey)}
        aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span>{label}</span>
        <span className="table-sort-icons" aria-hidden>
          {active ? (dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
        </span>
      </button>
    </th>
  );
}
