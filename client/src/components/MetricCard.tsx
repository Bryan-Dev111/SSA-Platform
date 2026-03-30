/**
 * Dashboard-style summary card: label, primary value, optional muted subtitle.
 */
export function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
}) {
  return (
    <div className="card">
      <div className="card-body" style={{ padding: '0.9rem' }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{title}</div>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{value}</div>
        {subtitle ? (
          <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', lineHeight: 1.35 }}>
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
