/**
 * Dropdown for admin-configured reference codes (defect, disposition).
 * Preserves a value not present in the current list (legacy / inactive codes).
 */
export interface ReferenceCodeOption {
  id: string;
  code: string;
  name: string | null;
}

export function ReferenceCodeSelect({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReferenceCodeOption[];
  disabled?: boolean;
}) {
  const codes = options.map((o) => o.code);
  const orphan = Boolean(value && !codes.includes(value));
  return (
    <div className="input-group">
      <label className="input-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">— None —</option>
        {orphan && <option value={value}>{value} (not in list)</option>}
        {options.map((o) => (
          <option key={o.id} value={o.code}>
            {o.code}
            {o.name ? ` — ${o.name}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
