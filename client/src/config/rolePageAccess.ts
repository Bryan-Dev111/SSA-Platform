/**
 * Role–page access: which roles can view each path (from Day 1 matrix)
 * Used for menu visibility and route guards.
 *
 * Keep aligned with server `API_PAGE_ROLES` in `server/src/middleware/rbac.ts` (same roles per feature).
 */
export const PATH_ROLES: Record<string, string[]> = {
  /** Product chooser after login; Admin only */
  '/product-hub': ['Admin'],
  '/global-vendors': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/global-vendors/farmers': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/global-vendors/farm-profile': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/global-vendors/farm-processing': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/global-vendors/approved': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/global-vendors/map': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/global-vendors/relationship': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/global-vendors/purchase-orders': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/global-vendors/samples': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/global-vendors/admin': ['Admin'],
  '/dashboard': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/risk': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/corrective-actions': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer', 'Auditor'],
  '/car-record': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  '/findings': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  '/findings/create': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  '/findings-record': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  '/audits': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  '/audit-record': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  '/supplier-profile': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer', 'Supplier'],
  '/supplier-list': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/suppliers-map': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/records': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer', 'Supplier'],
  '/shipments': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer', 'Supplier'],
  '/documents': ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor'],
  '/internal-management': ['Admin', 'QualityManager'],
  '/admin': ['Admin'],
};

let runtimePathRoles: Record<string, string[]> = PATH_ROLES;
export const NO_ACCESS_PATH = '/no-access';

/** Keep in sync with sidebar order in Layout.tsx */
const SIDEBAR_PATH_ORDER = [
  '/dashboard',
  '/risk',
  '/corrective-actions',
  '/findings',
  '/audits',
  '/shipments',
  '/records',
  '/supplier-profile',
  '/supplier-list',
  '/suppliers-map',
  '/global-vendors/farmers',
  '/global-vendors/farm-profile',
  '/global-vendors/farm-processing',
  '/global-vendors/approved',
  '/global-vendors/map',
  '/global-vendors/relationship',
  '/global-vendors/purchase-orders',
  '/global-vendors/samples',
  '/global-vendors/admin',
  '/documents',
  '/internal-management',
  '/admin',
] as const;

export function setRuntimePathRoles(next?: Record<string, string[]> | null): void {
  /** Merge so client-only paths (e.g. /product-hub) survive when server matrix omits them. */
  runtimePathRoles =
    next && Object.keys(next).length > 0 ? { ...PATH_ROLES, ...next } : PATH_ROLES;
}

/** Paths that Supplier can access (own data only) */
export const SUPPLIER_PATHS = ['/supplier-profile', '/records', '/shipments'];

/**
 * Default landing path for the current user (so refresh and index route work for all roles)
 */
export function getDefaultPath(roleNames: string[]): string {
  if (roleNames.includes('Supplier') && canAccessPath('/supplier-profile', roleNames)) {
    return '/supplier-profile';
  }
  for (const path of SIDEBAR_PATH_ORDER) {
    if (canAccessPath(path, roleNames)) return path;
  }
  return NO_ACCESS_PATH;
}

export function canAccessPath(pathname: string, roleNames: string[]): boolean {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === NO_ACCESS_PATH) return true;
  const pathBase = path.split('/').slice(0, 2).join('/') || path;
  /** Prefer longest match so `/global-vendors/farmers` can differ from `/global-vendors/approved`. */
  const allowed = runtimePathRoles[path] ?? runtimePathRoles[pathBase];
  if (!allowed) return false;
  return roleNames.some((r) => allowed.includes(r));
}

export function isSupplierOnlyPath(path: string): boolean {
  return SUPPLIER_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}
