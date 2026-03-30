import { prisma } from './prisma';

/**
 * Column order for Admin → Permissions matrix and related DB seeding.
 * Match app nav order in `client/src/components/Layout.tsx` (`MENU_ITEMS`) /
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
  { key: 'SupplierList', label: 'Suppliers', path: '/supplier-list' },
  { key: 'SuppliersMap', label: 'Suppliers Map', path: '/suppliers-map' },
  { key: 'Documents', label: 'Command Media', path: '/documents' },
  { key: 'InternalManagement', label: 'Internal Management', path: '/internal-management' },
  { key: 'Admin', label: 'Admin', path: '/admin' },
] as const;

export const DEFAULT_API_PAGE_ROLES: Record<string, string[]> = {
  Dashboard: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  Risk: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  CorrectiveActions: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer', 'Auditor'],
  CARRecord: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  Findings: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  FindingsRecord: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  Audits: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'],
  SupplierProfile: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer', 'Supplier'],
  SupplierList: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  SuppliersMap: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  Records: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer', 'Supplier'],
  Shipments: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer', 'Supplier'],
  Documents: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor'],
  InternalManagement: ['Admin', 'QualityManager'],
  Admin: ['Admin'],
  Login: [],
};

/** All roles that may authenticate; used for product hub routes (not in PAGE_DEFINITIONS matrix). */
const ALL_APP_ROLES_HUB = [
  'Admin',
  'Viewer',
  'QualityEngineer',
  'QualityManager',
  'Buyer',
  'Auditor',
  'Supplier',
] as const;

export const DEFAULT_PATH_ROLES: Record<string, string[]> = {
  '/product-hub': [...ALL_APP_ROLES_HUB],
  '/global-vendors': [...ALL_APP_ROLES_HUB],
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
  '/records': DEFAULT_API_PAGE_ROLES.Records,
  '/shipments': DEFAULT_API_PAGE_ROLES.Shipments,
  '/documents': DEFAULT_API_PAGE_ROLES.Documents,
  '/internal-management': DEFAULT_API_PAGE_ROLES.InternalManagement,
  '/admin': DEFAULT_API_PAGE_ROLES.Admin,
};

export async function getPathRolesMatrix(): Promise<Record<string, string[]>> {
  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
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
    pathRoles[page.path] = [];
    for (const p of rowsForPage) {
      if (!p.canAccess) continue;
      const roleName = roleById.get(p.roleId);
      if (!roleName) continue;
      pathRoles[page.path].push(roleName);
    }
  }
  return pathRoles;
}

export async function getApiPageRolesMatrix(): Promise<Record<string, string[]>> {
  const pathRoles = await getPathRolesMatrix();
  return {
    ...DEFAULT_API_PAGE_ROLES,
    Dashboard: pathRoles['/dashboard'] ?? [],
    Risk: pathRoles['/risk'] ?? [],
    CorrectiveActions: pathRoles['/corrective-actions'] ?? [],
    Findings: pathRoles['/findings'] ?? [],
    Audits: pathRoles['/audits'] ?? [],
    SupplierList: pathRoles['/supplier-list'] ?? [],
    Records: pathRoles['/records'] ?? [],
    Documents: pathRoles['/documents'] ?? [],
    Admin: pathRoles['/admin'] ?? [],
  };
}
