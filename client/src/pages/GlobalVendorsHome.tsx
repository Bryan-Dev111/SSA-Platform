/**
 * Placeholder for Global Vendors product area; entry from Product hub.
 */
import { useNavigate } from 'react-router-dom';

export function GlobalVendorsHome() {
  const navigate = useNavigate();

  return (
    <div className="global-vendors-shell">
      <header className="global-vendors-header">
        <h1 className="global-vendors-title">Global Vendors – Additional Products</h1>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/product-hub')}>
          Back to product selection
        </button>
      </header>
      <main className="global-vendors-main">
        <p className="global-vendors-lead">
          This area is reserved for Global Vendors workflows. Use <strong>Back to product selection</strong> to return to
          the split screen and choose Sentinel Vendor Warranty (current product) or stay here as features are added.
        </p>
      </main>
    </div>
  );
}
