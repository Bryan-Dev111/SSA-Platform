/**
 * Protects routes: requires auth; enforces role-based path access
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessPath, getDefaultPath } from '../config/rolePageAccess';

interface ProtectedRouteProps {
  children: React.ReactNode;
  path?: string;
}

export function ProtectedRoute({ children, path: pathProp }: ProtectedRouteProps) {
  const { user, token, loading } = useAuth();
  const location = useLocation();
  const pathname = pathProp ?? location.pathname;

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const roleNames = user.roleNames;
  const allowed = canAccessPath(pathname, roleNames);
  if (!allowed) {
    return <Navigate to={getDefaultPath(roleNames)} replace />;
  }

  return <>{children}</>;
}
