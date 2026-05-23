import { prisma } from './prisma';

/**
 * Column order for Admin → Permissions matrix and related DB seeding.
 * Match app nav order in `client/src/components/Layout.tsx` (`MENU_ITEMS`, Global Vendors block) /
 * `client/src/config/rolePageAccess.ts` (`SIDEBAR_PATH_ORDER`). Place record/detail
 * pages immediately after their primary section (CAR Record after Corrective Actions,
 * Findings Record after Findings).
 */
export const PAGE_DEFINITIONS = [
  { key: 'Dashboard', label: 'Dashboard', path: '/dashboard' },
  { key: 'Risk', label: 'Risk', path: '/risk' },
  { key: 'CorrectiveActions', label: 'CAR', path: '/corrective-actions' },
  { key: 'CARRecord', label: 'CAR Record', path: '/car-record' },
  { key: 'Findings', label: 'Findings', path: '/findings' },
  { key: 'FindingsRecord', label: 'Findings Record', path: '/findings-record' },
  { key: 'Audits', label: 'Audits', path: '/audits' },
  { key: 'Shipments', label: 'Shipments', path: '/shipments' },
  { key: 'Records', label: 'Records', path: '/records' },
  { key: 'SupplierProfile', label: 'Supplier Profile', path: '/supplier-profile' },
  { key: 'SupplierList', label: 'Approved Suppliers List', path: '/supplier-list' },
  { key: 'SuppliersMap', label: 'Suppliers Map', path: '/suppliers-map' },
  { key: 'GlobalSupplyDashboard', label: 'Business Dashboard', path: '/global-vendors/dashboard' },
  { key: 'GlobalSupplyFarmDashboard', label: 'Farm Dashboard', path: '/global-vendors/farm-dashboard' },
  { key: 'GlobalSupplyFarmers', label: 'Farmer Information', path: '/global-vendors/farmers' },
  { key: 'GlobalSupplyFarmProfile', label: 'Farm profile', path: '/global-vendors/farm-profile' },
  {
    key: 'GlobalSupplyProcessingQuality',
    label: 'Processing & quality',
    path: '/global-vendors/processing-quality',
  },
  { key: 'GlobalSupplyApproved', label: 'Approved Farms List', path: '/global-vendors/approved' },
  { key: 'GlobalSupplyMap', label: 'Farms Map', path: '/global-vendors/map' },
  { key: 'GlobalSupplyRelationship', label: 'Relationship & Trust', path: '/global-vendors/relationship' },
  {
    key: 'GlobalSupplyBuyerRelationships',
    label: 'Buyer Relationships',
    path: '/global-vendors/buyer-relationships',
  },
  { key: 'GlobalSupplyPurchaseOrders', label: 'Purchase Orders', path: '/global-vendors/purchase-orders' },
  { key: 'GlobalSupplySamples', label: 'Samples', path: '/global-vendors/samples' },
  { key: 'GlobalSupplyLogistics', label: 'Logistics', path: '/global-vendors/logistics' },
  { key: 'GlobalSupplyExpenses', label: 'Expenses', path: '/global-vendors/expenses' },
  { key: 'GlobalSupplyWorkLogs', label: 'Global Supply Work Logs', path: '/global-vendors/work-logs' },
  {
    key: 'GlobalSupplyInternalManagement',
    label: 'Global Supply Internal Management',
    path: '/global-vendors/internal-management',
  },
  { key: 'Documents', label: 'Command Media', path: '/documents' },
  { key: 'WorkLogs', label: 'Work Logs', path: '/work-logs' },
  { key: 'InternalManagement', label: 'Internal Management', path: '/internal-management' },
  { key: 'Admin', label: 'Admin', path: '/admin' },
] as const;

/** Role rows omitted from Global Vendors Admin → Permissions (main SSA roles). */
export const GLOBAL_VENDORS_ADMIN_PERMISSIONS_EXCLUDED_ROLES = new Set([
  'Auditor',
  'Buyer',
  'Inspector',
  'QualityEngineer',
  'QualityManager',
  'Supplier',
]);

export const DEFAULT_API_PAGE_ROLES: Record<string, string[]> = {
  Dashboard: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer'],
  Risk: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer'],
  CorrectiveActions: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'Auditor'],
  CARRecord: ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  Findings: ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  FindingsRecord: ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  Audits: ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  SupplierProfile: ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer', 'Supplier'],
  SupplierList: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer'],
  SuppliersMap: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer'],
  GlobalSupplyDashboard: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  GlobalSupplyFarmDashboard: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  GlobalSupplyFarmers: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  GlobalSupplyFarmProfile: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  GlobalSupplyProcessingQuality: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  GlobalSupplyApproved: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  GlobalSupplyMap: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  GlobalSupplyRelationship: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  GlobalSupplyBuyerRelationships: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  GlobalSupplyPurchaseOrders: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  GlobalSupplySamples: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  GlobalSupplyLogistics: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  GlobalSupplyExpenses: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'CommodityBuyer', 'SourcingDirector'],
  GlobalSupplyWorkLogs: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'Auditor', 'CommodityBuyer', 'SourcingDirector'],
  GlobalSupplyInternalManagement: [
    'Admin',
    'QualityEngineer',
    'QualityManager',
    'Buyer',
    'CommodityBuyer',
    'SourcingDirector',
  ],
  Records: ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer', 'Supplier'],
  Shipments: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'Supplier', 'Auditor', 'Inspector'],
  Documents: ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor'],
  WorkLogs: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'Auditor'],
  InternalManagement: ['Admin', 'QualityManager'],
  Admin: ['Admin'],
  Login: [],
};

/** Roles that appear on Global Supply pages but never on Sentinel (non–Global Supply) matrix pages. */
function computeSentinelAdminPermissionsExcludedRoles(): Set<string> {
  const onSentinelPages = new Set<string>();
  for (const def of PAGE_DEFINITIONS) {
    if (def.path.startsWith('/global-vendors')) continue;
    const arr = DEFAULT_API_PAGE_ROLES[def.key as keyof typeof DEFAULT_API_PAGE_ROLES];
    if (Array.isArray(arr)) for (const r of arr) onSentinelPages.add(r);
  }
  const gvOnly = new Set<string>();
  for (const def of PAGE_DEFINITIONS) {
    if (!def.path.startsWith('/global-vendors')) continue;
    const arr = DEFAULT_API_PAGE_ROLES[def.key as keyof typeof DEFAULT_API_PAGE_ROLES];
    if (!Array.isArray(arr)) continue;
    for (const r of arr) {
      if (!onSentinelPages.has(r)) gvOnly.add(r);
    }
  }
  // Farm login role exists in auth but has no SSA matrix rows (GV farm UI).
  gvOnly.add('Farmer');
  // Global Supply logistics–oriented role (often created with spaced display name in DB).
  gvOnly.add('LogisticsCoordinator');
  return gvOnly;
}

/**
 * Map stored / display role names to the canonical names used in DEFAULT_API_PAGE_ROLES.
 * Admin UI may show "Commodity Buyer" while the DB stores that string or `CommodityBuyer`; exclusions use canonical keys.
 */
const ROLE_NAME_TO_CANONICAL: Record<string, string> = {
  'Commodity Buyer': 'CommodityBuyer',
  'Sourcing Director': 'SourcingDirector',
  'Quality Engineer': 'QualityEngineer',
  'Quality Manager': 'QualityManager',
  'Logistics Coordinator': 'LogisticsCoordinator',
};

export function canonicalRoleNameForPermissionMatrix(roleName: string): string {
  const t = roleName.trim();
  return ROLE_NAME_TO_CANONICAL[t] ?? t;
}

/** Role rows omitted from Sentinel Admin → Permissions (Global Supply–only accounts). */
export const SENTINEL_ADMIN_PERMISSIONS_EXCLUDED_ROLES = computeSentinelAdminPermissionsExcludedRoles();

/** User accounts that should not appear on Supplier Assurance Admin → Users (only Global Supply roles). */
export function isGlobalSupplyOnlyUserRoleNames(roleNames: string[]): boolean {
  if (!roleNames.length) return false;
  const unique = new Set(roleNames.map((n) => canonicalRoleNameForPermissionMatrix(n)));
  for (const r of unique) {
    if (!SENTINEL_ADMIN_PERMISSIONS_EXCLUDED_ROLES.has(r)) return false;
  }
  return true;
}

/** All roles that may authenticate; used for product hub routes (not in PAGE_DEFINITIONS matrix). */
const ALL_APP_ROLES_HUB = [
  'Admin',
  'QualityEngineer',
  'QualityManager',
  'Buyer',
  'Auditor',
  'Inspector',
  'Supplier',
] as const;

export const DEFAULT_PATH_ROLES: Record<string, string[]> = {
  '/product-hub': ['Admin'],
  '/dashboard': DEFAULT_API_PAGE_ROLES.Dashboard,
  '/risk': DEFAULT_API_PAGE_ROLES.Risk,
  '/corrective-actions': DEFAULT_API_PAGE_ROLES.CorrectiveActions,
  '/car-record': DEFAULT_API_PAGE_ROLES.CARRecord,
  '/findings': DEFAULT_API_PAGE_ROLES.Findings,
  '/findings-record': DEFAULT_API_PAGE_ROLES.FindingsRecord,
  '/audits': DEFAULT_API_PAGE_ROLES.Audits,
  '/audit-record': DEFAULT_API_PAGE_ROLES.Audits,
  '/supplier-profile': DEFAULT_API_PAGE_ROLES.SupplierProfile,
  '/supplier-list': DEFAULT_API_PAGE_ROLES.SupplierList,
  '/suppliers-map': DEFAULT_API_PAGE_ROLES.SuppliersMap,
  '/global-vendors/dashboard': DEFAULT_API_PAGE_ROLES.GlobalSupplyDashboard,
  '/global-vendors/farm-dashboard': DEFAULT_API_PAGE_ROLES.GlobalSupplyFarmDashboard,
  '/global-vendors': DEFAULT_API_PAGE_ROLES.GlobalSupplyFarmers,
  '/global-vendors/farmers': DEFAULT_API_PAGE_ROLES.GlobalSupplyFarmers,
  '/global-vendors/farm-profile': DEFAULT_API_PAGE_ROLES.GlobalSupplyFarmProfile,
  '/global-vendors/processing-quality': DEFAULT_API_PAGE_ROLES.GlobalSupplyProcessingQuality,
  '/global-vendors/approved': DEFAULT_API_PAGE_ROLES.GlobalSupplyApproved,
  '/global-vendors/map': DEFAULT_API_PAGE_ROLES.GlobalSupplyMap,
  '/global-vendors/relationship': DEFAULT_API_PAGE_ROLES.GlobalSupplyRelationship,
  '/global-vendors/buyer-relationships': DEFAULT_API_PAGE_ROLES.GlobalSupplyBuyerRelationships,
  '/global-vendors/purchase-orders': DEFAULT_API_PAGE_ROLES.GlobalSupplyPurchaseOrders,
  '/global-vendors/samples': DEFAULT_API_PAGE_ROLES.GlobalSupplySamples,
  '/global-vendors/logistics': DEFAULT_API_PAGE_ROLES.GlobalSupplyLogistics,
  '/global-vendors/expenses': DEFAULT_API_PAGE_ROLES.GlobalSupplyExpenses,
  '/global-vendors/work-logs': DEFAULT_API_PAGE_ROLES.GlobalSupplyWorkLogs,
  '/global-vendors/internal-management': DEFAULT_API_PAGE_ROLES.GlobalSupplyInternalManagement,
  '/global-vendors/admin': DEFAULT_API_PAGE_ROLES.Admin,
  '/records': DEFAULT_API_PAGE_ROLES.Records,
  '/shipments': DEFAULT_API_PAGE_ROLES.Shipments,
  '/documents': DEFAULT_API_PAGE_ROLES.Documents,
  '/work-logs': DEFAULT_API_PAGE_ROLES.WorkLogs,
  '/internal-management': DEFAULT_API_PAGE_ROLES.InternalManagement,
  '/admin': DEFAULT_API_PAGE_ROLES.Admin,
};

const DEPRECATED_ROLE_NAMES = new Set(['Viewer']);

export async function getPathRolesMatrix(): Promise<Record<string, string[]>> {
  const roles = await prisma.role.findMany({
    where: { name: { notIn: [...DEPRECATED_ROLE_NAMES] } },
    select: { id: true, name: true },
  });
  const permissions = await prisma.rolePagePermission.findMany({
    where: { pageKey: { in: PAGE_DEFINITIONS.map((p) => p.key) } },
    select: { roleId: true, pageKey: true, canAccess: true },
  });
  if (permissions.length === 0) return DEFAULT_PATH_ROLES;
  const roleById = new Map(roles.map((r) => [r.id, r.name]));
  const pathRoles: Record<string, string[]> = { ...DEFAULT_PATH_ROLES };
  for (const page of PAGE_DEFINITIONS) {
    const rowsForPage = permissions.filter((p) => p.pageKey === page.key);
    if (rowsForPage.length === 0) continue; // keep DEFAULT_PATH_ROLES fallback when no rows exist yet
    const fromDb: string[] = [];
    for (const p of rowsForPage) {
      if (!p.canAccess) continue;
      const roleName = roleById.get(p.roleId);
      if (!roleName) continue;
      fromDb.push(roleName);
    }
    const baseline = DEFAULT_PATH_ROLES[page.path] ?? [];
    pathRoles[page.path] = [...new Set([...baseline, ...fromDb])];
  }
  return pathRoles;
}

/**
 * Page-key → roles for `requirePageAccess(pageKey)`.
 * Merges each path’s live matrix with code defaults so a partial DB matrix (e.g. Shipments missing Auditor)
 * cannot drop roles below product defaults or yield an empty list (which would 403 every user).
 */
export async function getApiPageRolesMatrix(): Promise<Record<string, string[]>> {
  const pathRoles = await getPathRolesMatrix();
  const merged: Record<string, string[]> = { ...DEFAULT_API_PAGE_ROLES };
  for (const page of PAGE_DEFINITIONS) {
    const key = page.key as keyof typeof DEFAULT_API_PAGE_ROLES;
    const def = DEFAULT_API_PAGE_ROLES[key];
    if (!Array.isArray(def) || def.length === 0) continue;
    const fromPath = pathRoles[page.path] ?? [];
    (merged as Record<string, string[]>)[page.key] = [...new Set([...def, ...fromPath])];
  }
  return merged;
}
