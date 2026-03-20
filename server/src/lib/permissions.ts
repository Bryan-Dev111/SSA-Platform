import { prisma } from './prisma';

export const PAGE_DEFINITIONS = [
  { key: 'Dashboard', label: 'Dashboard', path: '/dashboard' },
  { key: 'Risk', label: 'Risk', path: '/risk' },
  { key: 'CorrectiveActions', label: 'CAR', path: '/corrective-actions' },
  { key: 'Findings', label: 'Findings', path: '/findings' },
  { key: 'Audits', label: 'Audits', path: '/audits' },
  { key: 'SupplierList', label: 'Suppliers', path: '/supplier-list' },
  { key: 'Records', label: 'Records', path: '/records' },
  { key: 'Documents', label: 'Documents', path: '/documents' },
  { key: 'Admin', label: 'Admin', path: '/admin' },
] as const;

export const DEFAULT_API_PAGE_ROLES: Record<string, string[]> = {
  Dashboard: ['Admin', 'Viewer', 'QualityEngineer', 'Buyer'],
  Risk: ['Admin', 'Viewer', 'QualityEngineer', 'Buyer'],
  CorrectiveActions: ['Admin', 'Viewer', 'QualityEngineer', 'Buyer', 'Auditor'],
  CARRecord: ['Admin', 'Viewer', 'QualityEngineer', 'Auditor', 'Buyer'],
  Findings: ['Admin', 'Viewer', 'QualityEngineer', 'Auditor', 'Buyer'],
  FindingsRecord: ['Admin', 'Viewer', 'QualityEngineer', 'Auditor', 'Buyer'],
  Audits: ['Admin', 'Viewer', 'QualityEngineer', 'Auditor', 'Buyer'],
  SupplierProfile: ['Admin', 'Viewer', 'QualityEngineer', 'Auditor', 'Buyer', 'Supplier'],
  SupplierList: ['Admin', 'Viewer', 'QualityEngineer', 'Buyer'],
  SuppliersMap: ['Admin', 'Viewer', 'QualityEngineer', 'Buyer'],
  Records: ['Admin', 'Viewer', 'QualityEngineer', 'Auditor', 'Buyer', 'Supplier'],
  Shipments: ['Admin', 'Viewer', 'QualityEngineer', 'Buyer', 'Supplier'],
  Documents: ['Admin', 'Viewer', 'QualityEngineer', 'Auditor'],
  InternalManagement: ['Admin'],
  Admin: ['Admin'],
  Login: [],
};

export const DEFAULT_PATH_ROLES: Record<string, string[]> = {
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
    pathRoles[page.path] = [];
  }
  for (const p of permissions) {
    if (!p.canAccess) continue;
    const roleName = roleById.get(p.roleId);
    const page = PAGE_DEFINITIONS.find((d) => d.key === p.pageKey);
    if (!roleName || !page) continue;
    pathRoles[page.path].push(roleName);
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
