/**
 * Picks the first Global Vendors sub-route the user may access.
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canAccessPath, getDefaultPath } from '../../config/rolePageAccess';

export function GlobalVendorsIndex() {
  const { user } = useAuth();
  const roleNames = user?.roleNames ?? [];
  if (canAccessPath('/global-vendors/dashboard', roleNames)) {
    return <Navigate to="/global-vendors/dashboard" replace />;
  }
  if (canAccessPath('/global-vendors/farm-dashboard', roleNames)) {
    return <Navigate to="/global-vendors/farm-dashboard" replace />;
  }
  if (canAccessPath('/global-vendors/risk-intelligence', roleNames)) {
    return <Navigate to="/global-vendors/risk-intelligence" replace />;
  }
  if (canAccessPath('/global-vendors/farmers', roleNames)) {
    return <Navigate to="/global-vendors/farmers" replace />;
  }
  if (canAccessPath('/global-vendors/approved', roleNames)) {
    return <Navigate to="/global-vendors/approved" replace />;
  }
  return <Navigate to={getDefaultPath(roleNames)} replace />;
}
