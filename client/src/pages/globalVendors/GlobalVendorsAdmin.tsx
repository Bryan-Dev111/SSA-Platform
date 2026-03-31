import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AdminPermissionsPanel } from '../admin/AdminDay9Panels';

export function GlobalVendorsAdmin() {
  const { token } = useAuth();
  const toast = useToast();

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Global Vendors — Permissions</h1>
      </header>
      <AdminPermissionsPanel token={token} toast={toast} />
    </div>
  );
}

