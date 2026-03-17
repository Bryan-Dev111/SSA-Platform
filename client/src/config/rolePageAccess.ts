/**
 * Role–page access: which roles can view each path (from Day 1 matrix)
 * Used for menu visibility and route guards
 */
export const PATH_ROLES: Record<string, string[]> = {
  '/dashboard': ['Admin', 'Viewer', 'QualityEngineer', 'Buyer'],
  '/risk': ['Admin', 'Viewer', 'QualityEngineer', 'Buyer'],
  '/corrective-actions': ['Admin', 'Viewer', 'QualityEngineer', 'Buyer'],
  '/car-record': ['Admin', 'Viewer', 'QualityEngineer', 'Auditor', 'Buyer'],
  '/findings': ['Admin', 'Viewer', 'QualityEngineer', 'Auditor', 'Buyer'],
  '/findings-record': ['Admin', 'Viewer', 'QualityEngineer', 'Auditor', 'Buyer'],
  '/audits': ['Admin', 'Viewer', 'QualityEngineer', 'Auditor', 'Buyer'],
  '/supplier-profile': ['Admin', 'Viewer', 'QualityEngineer', 'Auditor', 'Buyer', 'Supplier'],
  '/supplier-list': ['Admin', 'Viewer', 'QualityEngineer', 'Buyer'],
  '/suppliers-map': ['Admin', 'Viewer', 'QualityEngineer', 'Buyer'],
  '/records': ['Admin', 'Viewer', 'QualityEngineer', 'Auditor', 'Buyer', 'Supplier'],
  '/shipments': ['Admin', 'Viewer', 'QualityEngineer', 'Buyer', 'Supplier'],
  '/documents': ['Admin', 'Viewer', 'QualityEngineer', 'Auditor'],
  '/internal-management': ['Admin'],
  '/admin': ['Admin'],
};

/** Paths that Supplier can access (own data only) */
export const SUPPLIER_PATHS = ['/supplier-profile', '/records', '/shipments'];

/** Fallback when user has no Dashboard access (e.g. Auditor-only) */
const FALLBACK_DEFAULT_PATH = '/car-record';

/**
 * Default landing path for the current user (so refresh and index route work for all roles)
 */
export function getDefaultPath(roleNames: string[]): string {
  if (roleNames.includes('Supplier')) return '/supplier-profile';
  if (!canAccessPath('/dashboard', roleNames)) return FALLBACK_DEFAULT_PATH;
  return '/dashboard';
}

export function canAccessPath(pathname: string, roleNames: string[]): boolean {
  const path = pathname.replace(/\/$/, '') || '/';
  const pathBase = path.split('/').slice(0, 2).join('/') || path;
  const allowed = PATH_ROLES[pathBase] ?? PATH_ROLES[path];
  if (!allowed) return false;
  return roleNames.some((r) => allowed.includes(r));
}

export function isSupplierOnlyPath(path: string): boolean {
  return SUPPLIER_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}
