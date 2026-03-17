/**
 * Generic placeholder for a page (title only)
 */
interface PlaceholderPageProps {
  title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-description">Content will be added in later phases.</p>
      </header>
      <div className="placeholder-empty">
        <strong>{title}</strong>
        This section is not yet implemented.
      </div>
    </div>
  );
}
