/**
 * Hides page content when the database is disconnected (except on the database control page).
 */
import { Outlet, useLocation } from 'react-router-dom';
import { useDatabaseConnection } from '../context/DatabaseConnectionContext';
import { useLanguage } from '../context/LanguageContext';

const DATABASE_PATH = '/global-vendors/database';

export function DatabaseDisconnectedGate() {
  const { connected, loading, isSuperUser } = useDatabaseConnection();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const path = pathname.replace(/\/$/, '') || '/';
  const isDatabasePage = path === DATABASE_PATH;
  const superBypass = isSuperUser && (isDatabasePage || path === '/product-hub');

  if (loading || connected || isDatabasePage || superBypass) {
    return <Outlet />;
  }

  return (
    <div className="page">
      <section className="card">
        <div className="card-body">
          <h1 className="page-title" style={{ marginTop: 0 }}>
            {t('superDb.blockedTitle', 'Database disconnected')}
          </h1>
          <p className="page-description" style={{ marginBottom: 0 }}>
            {t(
              'superDb.blockedBody',
              'Application data is unavailable because the database connection has been disconnected. A Super user can restore access from the Database tab in Global Supply.'
            )}
          </p>
        </div>
      </section>
    </div>
  );
}
