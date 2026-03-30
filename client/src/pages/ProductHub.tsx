/**
 * Post-login product chooser: Sentinel Vendor Warranty vs Global Vendors.
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
          aria-label="Sentinel Vendor Warranty — Current Products. Open supplier assurance and related tools."
        >
          <span className="product-hub-panel-kicker">Sentinel Vendor Warranty</span>
          <span className="product-hub-panel-title">Current Products</span>
          <span className="product-hub-panel-hint">Open supplier assurance, audits, risk, and related tools.</span>
        </button>
        <button
          type="button"
          className="product-hub-panel product-hub-panel--global"
          onClick={goGlobal}
          aria-label="Global Vendors — Additional Products. Open global vendor workflows."
        >
          <span className="product-hub-panel-kicker">Global Vendors</span>
          <span className="product-hub-panel-title">Additional Products</span>
          <span className="product-hub-panel-hint">Farmer information, approved farmers, and related supply workflows.</span>
        </button>
      </div>
    </div>
  );
}
