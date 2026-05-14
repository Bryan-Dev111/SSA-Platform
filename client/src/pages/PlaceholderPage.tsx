/**
 * Generic placeholder for a page (title only)
 */
import { useLanguage } from '../context/LanguageContext';

interface PlaceholderPageProps {
  title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  const { t } = useLanguage();
  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{t('placeholder.later')}</p>
      </header>
      <div className="placeholder-empty">
        <strong>{title}</strong>
        {t('placeholder.notImplemented')}
      </div>
    </div>
  );
}
