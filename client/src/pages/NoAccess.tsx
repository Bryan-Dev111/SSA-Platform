import { useLanguage } from '../context/LanguageContext';

export function NoAccess() {
  const { t } = useLanguage();
  return (
    <div className="page">
      <section className="card">
        <div className="card-body">
          <h1 className="page-title" style={{ marginTop: 0 }}>
            {t('noAccess.title')}
          </h1>
          <p className="page-description">{t('noAccess.body')}</p>
        </div>
      </section>
    </div>
  );
}
