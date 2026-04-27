/**
 * Role–page access: which roles can view each path (from Day 1 matrix)
 * Used for menu visibility and route guards.
 *
 * Keep aligned with server `API_PAGE_ROLES` in `server/src/middleware/rbac.ts` (same roles per feature).
 */
export const PATH_ROLES: Record<string, string[]> = {
  /** Product chooser after login; Admin only */
  '/product-hub': ['Admin'],
  '/global-vendors': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  '/global-vendors/dashboard': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  '/global-vendors/farm-dashboard': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  '/global-vendors/farmers': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  '/global-vendors/farm-profile': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  '/global-vendors/approved': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  '/global-vendors/map': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  '/global-vendors/relationship': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  '/global-vendors/buyer-relationships': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  '/global-vendors/internal-management': [
    'Admin',
    'QualityEngineer',
    'QualityManager',
    'Buyer',
    'CommodityBuyer',
    'SourcingDirector',
  ],
  /** Employee roster profile (linked from Employee Assignments); same gate as Global Supply Internal Management. */
  '/global-vendors/employee-profile': [
    'Admin',
    'QualityEngineer',
    'QualityManager',
    'Buyer',
    'CommodityBuyer',
    'SourcingDirector',
  ],
  /** Supplier Assurance Internal Management — employee profile detail. */
  '/internal-management/employee-profile': ['Admin', 'QualityManager'],
  '/global-vendors/work-logs': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'Auditor', 'CommodityBuyer', 'SourcingDirector'],
  '/global-vendors/purchase-orders': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  '/global-vendors/samples': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  '/global-vendors/logistics': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  '/global-vendors/logistics-profile': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  '/global-vendors/expenses': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  '/global-vendors/admin': ['Admin'],
  '/dashboard': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/risk': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/corrective-actions': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'Auditor'],
  '/car-record': ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  '/findings': ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  '/findings/create': ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  '/findings-record': ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  '/audits': ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  '/audit-record': ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  '/supplier-profile': ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer', 'Supplier'],
  '/supplier-list': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/suppliers-map': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer'],
  '/records': ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer', 'Supplier'],
  '/shipments': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'Supplier', 'Auditor', 'Inspector'],
  '/documents': ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor'],
  '/work-logs': ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'Auditor'],
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
  '/global-vendors/dashboard',
  '/global-vendors/farm-dashboard',
  '/global-vendors/farmers',
  '/global-vendors/approved',
  '/global-vendors/map',
  '/global-vendors/relationship',
  '/global-vendors/buyer-relationships',
  '/global-vendors/samples',
  '/global-vendors/logistics',
  '/global-vendors/work-logs',
  '/global-vendors/internal-management',
  '/global-vendors/admin',
  '/documents',
  '/work-logs',
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
  if (path.startsWith('/global-vendors/employee-profile/')) {
    const allowed = runtimePathRoles['/global-vendors/employee-profile'];
    if (!allowed?.length) return false;
    return roleNames.some((r) => allowed.includes(r));
  }
  if (path.startsWith('/internal-management/employee-profile/')) {
    const allowed = runtimePathRoles['/internal-management/employee-profile'];
    if (!allowed?.length) return false;
    return roleNames.some((r) => allowed.includes(r));
  }
  const pathBase = path.split('/').slice(0, 2).join('/') || path;
  /** Prefer longest match so `/global-vendors/farmers` can differ from `/global-vendors/approved`. */
  const allowed = runtimePathRoles[path] ?? runtimePathRoles[pathBase];
  if (!allowed) return false;
  return roleNames.some((r) => allowed.includes(r));
}

export function isSupplierOnlyPath(path: string): boolean {
  return SUPPLIER_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}
