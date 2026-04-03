/**
 * Post-login product chooser: Sentinel Supplier Assurance vs Sentinel Global Supply.
 */
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDefaultPath } from '../config/rolePageAccess';

export function ProductHub() {
  const navigate = useNavigate();
  const { user } = useAuth();

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
          aria-label="Sentinel Supplier Assurance. Open supplier assurance, audits, risk, and related tools."
        >
          <span className="product-hub-panel-title">Sentinel Supplier Assurance</span>
          <span className="product-hub-panel-hint">Open supplier assurance, audits, risk, and related tools.</span>
        </button>
        <button
          type="button"
          className="product-hub-panel product-hub-panel--global"
          onClick={goGlobal}
          aria-label="Sentinel Global Supply. Open global supply workflows."
        >
          <span className="product-hub-panel-title">Sentinel Global Supply</span>
          <span className="product-hub-panel-hint">Farmer information, approved farmers, and related supply workflows.</span>
        </button>
      </div>
    </div>
  );
}
