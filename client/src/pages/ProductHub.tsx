/**
 * Post-login product chooser: Sentinel Supplier Assurance vs Sentinel Global Supply.
 */
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getDefaultPath } from '../config/rolePageAccess';

export function ProductHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const goCurrent = () => {
    if (!user) return;
    navigate(getDefaultPath(user.roleNames));
  };

  const goGlobal = () => {
    // Index picks first GV route the user may access (farmers vs approved).
    navigate('/global-vendors');
  };

  return (
    <div className="product-hub-page" role="presentation">
      <div className="product-hub-row">
        <button
          type="button"
          className="product-hub-panel product-hub-panel--current"
          onClick={goCurrent}
          aria-label={`${t('productHub.current')}.`}
        >
          <span className="product-hub-panel-title">{t('productHub.current')}</span>
        </button>
        <button
          type="button"
          className="product-hub-panel product-hub-panel--global"
          onClick={goGlobal}
          aria-label={`${t('productHub.global')}.`}
        >
          <span className="product-hub-panel-title">{t('productHub.global')}</span>
        </button>
      </div>
    </div>
  );
}
