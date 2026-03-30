/**
 * Post-login product chooser: Sentinel Vendor Warranty vs Global Vendors.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDefaultPath } from '../config/rolePageAccess';

const STATUS_IDLE = 'Move the pointer over a side to see which product you are selecting.';

export function ProductHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState(STATUS_IDLE);

  const goCurrent = () => {
    if (!user) return;
    navigate(getDefaultPath(user.roleNames));
  };

  const goGlobal = () => {
    navigate('/global-vendors');
  };

  return (
    <div className="product-hub-page" role="presentation">
      <div className="product-hub-status" role="status" aria-live="polite">
        {status}
      </div>
      <div className="product-hub-row">
      <button
        type="button"
        className="product-hub-panel product-hub-panel--current"
        onClick={goCurrent}
        onMouseEnter={() =>
          setStatus('You are over: Sentinel Vendor Warranty — Current Products (click to open).')
        }
        onMouseLeave={() => setStatus(STATUS_IDLE)}
        onFocus={() =>
          setStatus('Keyboard focus: Sentinel Vendor Warranty — Current Products (press Enter to open).')
        }
        onBlur={() => setStatus(STATUS_IDLE)}
      >
        <span className="product-hub-panel-kicker">Sentinel Vendor Warranty</span>
        <span className="product-hub-panel-title">Current Products</span>
        <span className="product-hub-panel-hint">Open supplier assurance, audits, risk, and related tools.</span>
      </button>
      <button
        type="button"
        className="product-hub-panel product-hub-panel--global"
        onClick={goGlobal}
        onMouseEnter={() =>
          setStatus('You are over: Global Vendors — Additional Products (click to open).')
        }
        onMouseLeave={() => setStatus(STATUS_IDLE)}
        onFocus={() =>
          setStatus('Keyboard focus: Global Vendors — Additional Products (press Enter to open).')
        }
        onBlur={() => setStatus(STATUS_IDLE)}
      >
        <span className="product-hub-panel-kicker">Global Vendors</span>
        <span className="product-hub-panel-title">Additional Products</span>
        <span className="product-hub-panel-hint">Additional vendor and commodity workflows (placeholder).</span>
      </button>
      </div>
    </div>
  );
}
