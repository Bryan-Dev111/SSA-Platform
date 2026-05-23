/**
 * Users API: list + create (Admin). Link to Buyer/Supplier where applicable.
 */
import { Router, Request, Response } from 'express';
import { AlertCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { prisma, prismaBase } from '../lib/prisma';
import { encryptPassword, decryptPassword } from '../lib/passwordCrypto';
import { authMiddleware } from '../middleware/auth';
import { API_PAGE_ROLES, requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  DEFAULT_PATH_ROLES,
  PAGE_DEFINITIONS,
  canonicalRoleNameForPermissionMatrix,
  SENTINEL_ADMIN_PERMISSIONS_EXCLUDED_ROLES,
  GLOBAL_VENDORS_ADMIN_PERMISSIONS_EXCLUDED_ROLES,
  isGlobalSupplyOnlyUserRoleNames,
} from '../lib/permissions';
import { isSmtpConfigured } from '../lib/mail';
import { isHiddenSuperUserEmail } from '../lib/superUser';

const router = Router();

/** Supplier Assurance seed users — omit from Global Supply admin dashboard counts. */
const GLOBAL_SUPPLY_STATS_EXCLUDED_EMAIL = 'buyer@sentinel.local';

function isExcludedFromAdminLists(email: string): boolean {
  return (
    email.toLowerCase() === GLOBAL_SUPPLY_STATS_EXCLUDED_EMAIL.toLowerCase() ||
    isHiddenSuperUserEmail(email)
  );
}

const SOURCING_DIRECTOR_PO_EMAIL_CATEGORY: AlertCategory = 'sourcingDirectorPoCountryEmail';

/** In-app / dashboard alerts (email delivery can be wired later); matches `createAlertForRecipients` categories. */
const ALERT_EMAIL_MATRIX_CATEGORIES: AlertCategory[] = [
  'shipmentInspectionRequest',
  'rejectedShipmentDocument',
  'overdueCAR',
  'majorCriticalFinding',
];

const ALERT_RECIPIENT_ROLE_NAMES = ['Admin', 'QualityEngineer', 'Buyer', 'QualityManager'] as const;
const DEPRECATED_ROLE_NAMES = new Set(['Viewer']);
const ROLE_ALIASES: Record<string, string> = {
  admin: 'Admin',
  buyer: 'Buyer',
  supplier: 'Supplier',
  auditor: 'Auditor',
  qualityengineer: 'QualityEngineer',
  qualitymanager: 'QualityManager',
  qualitymanger: 'QualityManager',
  sourcingdirector: 'SourcingDirector',
};

function normalizeRoleName(name: string): string {
  const key = name.trim().toLowerCase().replace(/[\s_-]+/g, '');
  return ROLE_ALIASES[key] ?? name.trim();
}

function normalizeRoleNames(roleNames: string[]): string[] {
  return [...new Set(roleNames.map(normalizeRoleName).filter(Boolean))];
}

/** Lowercase slug for matching role names regardless of spaces/underscores (e.g. `Commodity Buyer` vs `CommodityBuyer`). */
function roleNameSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

async function resolveRoleRows(roleNamesInput: string[]): Promise<{ rows: Array<{ id: string; name: string }>; missing: string[] }> {
  const requested = normalizeRoleNames(roleNamesInput.map((r) => r.trim()).filter(Boolean));
  if (requested.length === 0) return { rows: [], missing: [] };
  const allRoles = await prisma.role.findMany({ select: { id: true, name: true } });
  const exactByName = new Map(allRoles.map((r) => [r.name, r] as const));
  const normalizedByName = new Map<string, { id: string; name: string }>();
  for (const role of allRoles) {
    const key = normalizeRoleName(role.name);
    if (!normalizedByName.has(key)) normalizedByName.set(key, role);
  }
  const rows: Array<{ id: string; name: string }> = [];
  const missing: string[] = [];
  for (const roleName of requested) {
    const resolved = exactByName.get(roleName) ?? normalizedByName.get(normalizeRoleName(roleName));
    if (!resolved) {
      missing.push(roleName);
      continue;
    }
    if (DEPRECATED_ROLE_NAMES.has(resolved.name)) {
      missing.push(roleName);
      continue;
    }
    if (!rows.some((r) => r.id === resolved.id)) rows.push(resolved);
  }
  return { rows, missing };
}

function parseIsEmployee(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'yes' || normalized === 'true' || normalized === '1';
  }
  if (typeof value === 'number') return value === 1;
  return false;
}

function parseIsContractor(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'contractor' || normalized === 'true' || normalized === '1';
  }
  if (typeof value === 'number') return value === 1;
  return false;
}

function assignedCountryNamesFromUser(u: {
  assignedCountries: { country: string }[];
  country: string | null;
}): string[] {
  const fromRows = u.assignedCountries.map((r) => r.country).filter(Boolean);
  if (fromRows.length > 0) {
    return [...new Set(fromRows)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }
  const legacy = u.country?.trim();
  return legacy ? [legacy] : [];
}

router.use(authMiddleware);
router.use(requireRole(['Admin']));

/** Global Supply admin dashboard: user / role counts (Admin only). */
router.get(
  '/global-supply-stats',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const notSupplierAssuranceDemoUser = {
      NOT: {
        OR: [
          { email: { equals: GLOBAL_SUPPLY_STATS_EXCLUDED_EMAIL, mode: 'insensitive' as const } },
          { email: { equals: 'engineerfullstack2@gmail.com', mode: 'insensitive' as const } },
        ],
      },
    };

    const [employees, roles, registeredFarms] = await Promise.all([
      prisma.user.count({
        where: {
          isEmployee: true,
          employmentStatus: 'Active',
          ...notSupplierAssuranceDemoUser,
        },
      }),
      prisma.role.findMany({ select: { id: true, name: true } }),
      prisma.farm.count(),
    ]);
    const commodityBuyerRoleIds = roles.filter((r) => roleNameSlug(r.name) === 'commoditybuyer').map((r) => r.id);
    const farmerRoleIds = roles.filter((r) => roleNameSlug(r.name) === 'farmer').map((r) => r.id);
    const [commodityBuyers, farmerAccounts] = await Promise.all([
      commodityBuyerRoleIds.length === 0
        ? 0
        : prisma.user.count({
            where: {
              userRoles: { some: { roleId: { in: commodityBuyerRoleIds } } },
              ...notSupplierAssuranceDemoUser,
            },
          }),
      farmerRoleIds.length === 0
        ? 0
        : prisma.user.count({
            where: {
              userRoles: { some: { roleId: { in: farmerRoleIds } } },
              ...notSupplierAssuranceDemoUser,
            },
          }),
    ]);
    res.json({
      employees,
      commodityBuyers,
      farmerAccounts,
      registeredFarms,
    });
  })
);

/** Canonical server permission matrix (for Admin UI; Day 9.4) */
router.get(
  '/permission-matrix',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const scopeRaw = typeof req.query.scope === 'string' ? req.query.scope.trim() : '';
    const scope = scopeRaw === 'sentinel' || scopeRaw === 'globalVendors' ? scopeRaw : 'all';

    const rolesAll = await prisma.role.findMany({
      where: { name: { notIn: [...DEPRECATED_ROLE_NAMES] } },
      select: { id: true, name: true, _count: { select: { userRoles: true } } },
      orderBy: { name: 'asc' },
    });
    const pagesAll = [...PAGE_DEFINITIONS];
    let pages = pagesAll;
    let roles = rolesAll;
    if (scope === 'sentinel') {
      pages = pagesAll.filter((p) => !p.path.startsWith('/global-vendors'));
      roles = rolesAll.filter(
        (r) => !SENTINEL_ADMIN_PERMISSIONS_EXCLUDED_ROLES.has(canonicalRoleNameForPermissionMatrix(r.name))
      );
    } else if (scope === 'globalVendors') {
      pages = pagesAll.filter((p) => p.path.startsWith('/global-vendors'));
      roles = rolesAll.filter(
        (r) => !GLOBAL_VENDORS_ADMIN_PERMISSIONS_EXCLUDED_ROLES.has(canonicalRoleNameForPermissionMatrix(r.name))
      );
    }

    const pageKeys = pages.map((p) => p.key);
    const perms = await prisma.rolePagePermission.findMany({
      where: { pageKey: { in: pageKeys } },
      select: { roleId: true, pageKey: true, canAccess: true },
    });
    const matrix: Record<string, Record<string, boolean>> = {};
    const roleRows = roles.map((r) => ({
      id: r.id,
      name: r.name,
      userCount: r._count.userRoles,
    }));
    for (const role of roles) {
      matrix[role.name] = {};
      for (const page of pages) {
        const row = perms.find((p) => p.roleId === role.id && p.pageKey === page.key);
        if (perms.length === 0) {
          matrix[role.name][page.key] = (DEFAULT_PATH_ROLES[page.path] ?? []).includes(role.name);
        } else {
          matrix[role.name][page.key] = row?.canAccess ?? (DEFAULT_PATH_ROLES[page.path] ?? []).includes(role.name);
        }
      }
    }
    const apiPageRolesPayload: Record<string, string[]> =
      scope === 'all'
        ? { ...API_PAGE_ROLES }
        : Object.fromEntries(
            pageKeys
              .map((key) => [key, API_PAGE_ROLES[key]] as const)
              .filter(([, arr]) => Array.isArray(arr))
          );
    res.json({
      apiPageRoles: apiPageRolesPayload,
      pages,
      roles: roles.map((r) => r.name),
      roleRows,
      matrix,
      adminOnlyDeletes: [
        { entity: 'Finding', method: 'DELETE', path: '/findings/:id' },
        { entity: 'Audit', method: 'DELETE', path: '/audits/:id' },
        { entity: 'CAR (CorrectiveAction)', method: 'DELETE', path: '/cars/:id' },
        { entity: 'Risk snapshot', method: 'DELETE', path: '/risk-snapshots/:id' },
        { entity: 'Opportunity', method: 'DELETE', path: '/opportunities/:id' },
        { entity: 'Supplier', method: 'DELETE', path: '/suppliers/:idOrCode' },
        { entity: 'User', method: 'DELETE', path: '/users/:id' },
        { entity: 'Role', method: 'DELETE', path: '/users/roles/:roleId' },
      ],
    });
  })
);

router.post(
  '/roles',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Role name is required' });
      return;
    }
    const created = await prisma.role.create({ data: { name } });
    res.status(201).json(created);
  })
);

/** Remove a custom / duplicate role when no users are assigned (Admin). Must be registered before `DELETE /:id` (user delete). */
router.delete(
  '/roles/:roleId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const roleId = String(req.params.roleId ?? '').trim();
    if (!roleId) {
      res.status(400).json({ error: 'roleId is required' });
      return;
    }

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true, _count: { select: { userRoles: true } } },
    });
    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    if (role.name === 'Admin') {
      res.status(400).json({ error: 'Cannot delete the Admin role' });
      return;
    }
    if (role._count.userRoles > 0) {
      res.status(400).json({
        error: `Cannot delete this role while ${role._count.userRoles} user(s) still have it. Remove the role from those users first.`,
      });
      return;
    }

    await prisma.role.delete({ where: { id: roleId } });
    res.status(204).send();
  })
);

/** Admin matrix: users (who receive operational alerts) × four key email topics */
router.get(
  '/alert-preferences-matrix',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const users = await prisma.user.findMany({
      where: {
        userRoles: {
          some: { role: { name: { in: [...ALERT_RECIPIENT_ROLE_NAMES] } } },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
      orderBy: { email: 'asc' },
    });
    const visibleUsers = users.filter((u) => !isExcludedFromAdminLists(u.email));
    const userIds = visibleUsers.map((u) => u.id);
    const prefs =
      userIds.length === 0
        ? []
        : await prisma.userAlertPreference.findMany({
            where: {
              userId: { in: userIds },
              alertCategory: { in: ALERT_EMAIL_MATRIX_CATEGORIES },
            },
            select: { userId: true, alertCategory: true, enabled: true },
          });
    const prefByUser = new Map<string, Map<AlertCategory, boolean>>();
    for (const p of prefs) {
      if (!prefByUser.has(p.userId)) prefByUser.set(p.userId, new Map());
      prefByUser.get(p.userId)!.set(p.alertCategory, p.enabled);
    }
    const matrix: Record<string, Record<string, boolean>> = {};
    for (const u of visibleUsers) {
      matrix[u.id] = {};
      for (const cat of ALERT_EMAIL_MATRIX_CATEGORIES) {
        const v = prefByUser.get(u.id)?.get(cat);
        matrix[u.id][cat] = v !== false;
      }
    }
    const categoryLabels: Record<string, string> = {
      shipmentInspectionRequest: 'New shipping requests',
      rejectedShipmentDocument: 'Rejected shipments',
      overdueCAR: 'Overdue CARs',
      majorCriticalFinding: 'New major / critical finding',
    };
    res.json({
      categories: ALERT_EMAIL_MATRIX_CATEGORIES.map((key) => ({
        key,
        label: categoryLabels[key] ?? key,
      })),
      users: visibleUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        roleNames: normalizeRoleNames(u.userRoles.map((ur) => ur.role.name)),
      })),
      matrix,
    });
  })
);

router.put(
  '/alert-preferences-matrix',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const matrixRaw = req.body?.matrix as Record<string, Record<string, boolean>> | undefined;
    if (!matrixRaw || typeof matrixRaw !== 'object') {
      res.status(400).json({ error: 'matrix is required' });
      return;
    }
    const allowedUsers = await prisma.user.findMany({
      where: {
        userRoles: {
          some: { role: { name: { in: [...ALERT_RECIPIENT_ROLE_NAMES] } } },
        },
      },
      select: { id: true },
    });
    const allowedIds = new Set(allowedUsers.map((u) => u.id));
    const ops = [];
    for (const userId of Object.keys(matrixRaw)) {
      if (!allowedIds.has(userId)) continue;
      const row = matrixRaw[userId];
      if (!row || typeof row !== 'object') continue;
      for (const cat of ALERT_EMAIL_MATRIX_CATEGORIES) {
        if (!(cat in row)) continue;
        const enabled = Boolean(row[cat]);
        ops.push(
          prismaBase.userAlertPreference.upsert({
            where: { userId_alertCategory: { userId, alertCategory: cat } },
            create: { userId, alertCategory: cat, enabled },
            update: { enabled },
          })
        );
      }
    }
    if (ops.length > 0) {
      await prismaBase.$transaction(ops);
    }
    res.json({ ok: true });
  })
);

/** Global Supply Admin → Email alerts: Sourcing Director PO notifications by assigned country. */
router.get(
  '/sourcing-director-po-email-preferences',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    function normCountry(s: string | null | undefined): string {
      return (s ?? '').trim();
    }
    const directors = await prisma.user.findMany({
      where: { userRoles: { some: { role: { name: 'SourcingDirector' } } } },
      select: {
        id: true,
        email: true,
        name: true,
        country: true,
        assignedCountries: { select: { country: true }, orderBy: { country: 'asc' } },
      },
      orderBy: { email: 'asc' },
    });
    const ids = directors.map((d) => d.id);
    const prefs =
      ids.length === 0
        ? []
        : await prisma.userAlertPreference.findMany({
            where: { userId: { in: ids }, alertCategory: SOURCING_DIRECTOR_PO_EMAIL_CATEGORY },
            select: { userId: true, enabled: true },
          });
    const prefMap = new Map(prefs.map((p) => [p.userId, p.enabled]));

    res.json({
      smtpConfigured: isSmtpConfigured(),
      directors: directors.map((d) => {
        const countries = [
          ...d.assignedCountries.map((c) => normCountry(c.country)).filter(Boolean),
          ...(normCountry(d.country) ? [normCountry(d.country)] : []),
        ];
        const unique = [...new Set(countries)];
        return {
          id: d.id,
          email: d.email,
          name: d.name,
          assignedCountryNames: unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
          emailEnabled: prefMap.get(d.id) !== false,
        };
      }),
    });
  })
);

router.put(
  '/sourcing-director-po-email-preferences',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const raw = req.body?.preferences as Record<string, boolean> | undefined;
    if (!raw || typeof raw !== 'object') {
      res.status(400).json({ error: 'preferences object is required' });
      return;
    }
    const directors = await prisma.user.findMany({
      where: { userRoles: { some: { role: { name: 'SourcingDirector' } } } },
      select: { id: true },
    });
    const allowed = new Set(directors.map((d) => d.id));
    const ops = [];
    for (const [userId, enabled] of Object.entries(raw)) {
      if (!allowed.has(userId)) continue;
      ops.push(
        prismaBase.userAlertPreference.upsert({
          where: { userId_alertCategory: { userId, alertCategory: SOURCING_DIRECTOR_PO_EMAIL_CATEGORY } },
          create: { userId, alertCategory: SOURCING_DIRECTOR_PO_EMAIL_CATEGORY, enabled: Boolean(enabled) },
          update: { enabled: Boolean(enabled) },
        })
      );
    }
    if (ops.length > 0) {
      await prismaBase.$transaction(ops);
    }
    res.json({ ok: true });
  })
);

router.put(
  '/permission-matrix',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const matrixRaw = req.body?.matrix as Record<string, Record<string, boolean>> | undefined;
    if (!matrixRaw || typeof matrixRaw !== 'object') {
      res.status(400).json({ error: 'matrix is required' });
      return;
    }
    const roles = await prisma.role.findMany({ select: { id: true, name: true } });
    const roleIdByName = new Map(roles.map((r) => [r.name, r.id]));
    const ops: ReturnType<typeof prismaBase.rolePagePermission.upsert>[] = [];
    for (const roleName of Object.keys(matrixRaw)) {
      const roleId = roleIdByName.get(roleName);
      if (!roleId) continue;
      const row = matrixRaw[roleName] ?? {};
      for (const page of PAGE_DEFINITIONS) {
        if (!Object.prototype.hasOwnProperty.call(row, page.key)) continue;
        const canAccess = Boolean(row[page.key]);
        ops.push(
          prismaBase.rolePagePermission.upsert({
            where: { roleId_pageKey: { roleId, pageKey: page.key } },
            create: { roleId, pageKey: page.key, canAccess },
            update: { canAccess },
          })
        );
      }
    }
    if (ops.length) {
      await prismaBase.$transaction(ops);
    }
    res.json({ ok: true });
  })
);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const scopeRaw = typeof req.query.scope === 'string' ? req.query.scope.trim() : '';
    const sentinelUserList = scopeRaw === 'sentinel';

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        passwordEncrypted: true,
        isEmployee: true,
        isContractor: true,
        employmentStatus: true,
        hourlyRate: true,
        currency: true,
        country: true,
        employmentResponsibilities: true,
        employmentNotes: true,
        commodityTypeId: true,
        commodityType: { select: { id: true, name: true } },
        createdAt: true,
        userRoles: { select: { role: { select: { id: true, name: true } } } },
        supplier: { select: { id: true, code: true, name: true } },
        buyerSuppliers: { select: { supplierId: true } },
        qeSuppliers: { select: { supplierId: true } },
        auditorSuppliers: { select: { supplierId: true } },
        employeeSuppliers: { select: { supplierId: true } },
        qeBuyers: { select: { buyerId: true } },
        qmQes: { select: { qualityEngineerId: true } },
        sourcingDirectorStaffAsDirector: { select: { staffUserId: true } },
        assignedCountries: { select: { country: true }, orderBy: { country: 'asc' } },
      },
      orderBy: { email: 'asc' },
    });
    const mapped = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isEmployee: u.isEmployee,
      isContractor: u.isContractor,
      employmentStatus: u.employmentStatus,
      hourlyRate: u.hourlyRate,
      currency: u.currency,
      country: u.country,
      assignedCountryNames: assignedCountryNamesFromUser(u),
      employmentResponsibilities: u.employmentResponsibilities,
      employmentNotes: u.employmentNotes,
      commodityTypeId: u.commodityTypeId,
      commodityType: u.commodityType ?? undefined,
      createdAt: u.createdAt,
      passwordPlain: decryptPassword(u.passwordEncrypted),
      roleNames: u.userRoles.map((ur) => ur.role.name),
      supplier: u.supplier ?? undefined,
      assignedSupplierIds: u.buyerSuppliers.map((b) => b.supplierId),
      qeAssignedSupplierIds: u.qeSuppliers.map((q) => q.supplierId), // legacy direct mapping
      auditorAssignedSupplierIds: u.auditorSuppliers.map((a) => a.supplierId),
      employeeAssignedSupplierIds: u.employeeSuppliers.map((a) => a.supplierId),
      qeAssignedBuyerIds: u.qeBuyers.map((qb) => qb.buyerId),
      qmAssignedQeIds: u.qmQes.map((qq) => qq.qualityEngineerId),
      sourcingDirectorAssignedStaffIds: u.sourcingDirectorStaffAsDirector.map((r) => r.staffUserId),
    }));
    const payload = (sentinelUserList
      ? mapped.filter((u) => !isGlobalSupplyOnlyUserRoleNames(u.roleNames))
      : mapped
    ).filter((u) => !isExcludedFromAdminLists(u.email));
    res.json(payload);
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
    const lastName = typeof req.body?.lastName === 'string' ? req.body.lastName.trim() : '';
    const nameFromParts = [firstName, lastName].filter(Boolean).join(' ').trim();
    const nameLegacy = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const name = nameFromParts || nameLegacy || null;
    const isEmployee = parseIsEmployee(req.body?.isEmployee);
    const isContractor = parseIsContractor(req.body?.isContractor);
    const employmentStatusRaw = typeof req.body?.employmentStatus === 'string' ? req.body.employmentStatus.trim() : '';
    const employmentStatus = employmentStatusRaw.toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
    const hourlyRateRaw = req.body?.hourlyRate;
    const hourlyRate =
      hourlyRateRaw === undefined || hourlyRateRaw === null || hourlyRateRaw === '' ? null : Number(hourlyRateRaw);
    let currency = typeof req.body?.currency === 'string' ? req.body.currency.trim() || null : null;
    /* Hourly compensation is USD-only in product UI; default when an hourly rate is set. */
    if (hourlyRate !== null && !currency) {
      currency = 'USD';
    }
    const country = typeof req.body?.country === 'string' ? req.body.country.trim() || null : null;
    const roleNamesRaw = Array.isArray(req.body?.roleNames) ? (req.body.roleNames as unknown[]).map(String) : [];
    const roleNames = normalizeRoleNames(roleNamesRaw);
    if (!emailRaw || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }
    if (roleNames.length === 0) {
      res.status(400).json({ error: 'roleNames must include at least one role' });
      return;
    }
    if (hourlyRate !== null && (!Number.isFinite(hourlyRate) || hourlyRate < 0)) {
      res.status(400).json({ error: 'hourlyRate must be a non-negative number' });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { email: emailRaw } });
    if (existing) {
      res.status(400).json({ error: 'Email already in use' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const passwordEncrypted = encryptPassword(password);
    const { rows: roleRows, missing } = await resolveRoleRows(roleNames);
    if (missing.length > 0 || roleRows.length !== roleNames.length) {
      res.status(400).json({ error: 'One or more role names are invalid' });
      return;
    }
    const user = await prisma.user.create({
      data: {
        email: emailRaw,
        passwordHash,
        passwordEncrypted,
        name,
        isEmployee,
        isContractor,
        employmentStatus,
        hourlyRate,
        currency,
        country,
        userRoles: {
          create: roleRows.map((r) => ({ roleId: r.id })),
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        isEmployee: true,
        isContractor: true,
        employmentStatus: true,
        hourlyRate: true,
        currency: true,
        country: true,
        createdAt: true,
        userRoles: { select: { role: { select: { id: true, name: true } } } },
        supplier: { select: { id: true, code: true, name: true } },
        buyerSuppliers: { select: { supplierId: true } },
        qeSuppliers: { select: { supplierId: true } },
      },
    });
    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      isEmployee: user.isEmployee,
      isContractor: user.isContractor,
      employmentStatus: user.employmentStatus,
      hourlyRate: user.hourlyRate,
      currency: user.currency,
      country: user.country,
      createdAt: user.createdAt,
      roleNames: normalizeRoleNames(user.userRoles.map((ur) => ur.role.name)),
      supplier: user.supplier ?? undefined,
      assignedSupplierIds: user.buyerSuppliers.map((b) => b.supplierId),
      qeAssignedSupplierIds: user.qeSuppliers.map((q) => q.supplierId),
    });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    if (!req.user || req.user.id === id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    /**
     * Clear FKs without onDelete behavior so the user row can be removed.
     * (Buyer on ClientHistory, approvals, etc. use onDelete: SetNull and are handled by Prisma.)
     */
    await prismaBase.$transaction(async (tx) => {
      await tx.supplier.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.finding.updateMany({ where: { createdById: id }, data: { createdById: null } });
      await tx.correctiveAction.updateMany({ where: { createdById: id }, data: { createdById: null } });
      await tx.record.updateMany({ where: { uploadedById: id }, data: { uploadedById: null } });
      await tx.opportunity.updateMany({ where: { createdById: id }, data: { createdById: null } });
      await tx.riskAction.updateMany({ where: { createdById: id }, data: { createdById: null } });
      await tx.user.delete({ where: { id } });
    });

    res.status(204).send();
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const data: {
      email?: string;
      name?: string | null;
      isEmployee?: boolean;
      isContractor?: boolean;
      employmentStatus?: 'Active' | 'Inactive';
      hourlyRate?: number | null;
      currency?: string | null;
      country?: string | null;
      employmentResponsibilities?: string | null;
      employmentNotes?: string | null;
      commodityTypeId?: string | null;
      passwordHash?: string;
      passwordEncrypted?: string | null;
    } = {};

    if ('email' in req.body) {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!email) {
        res.status(400).json({ error: 'email cannot be empty' });
        return;
      }
      const duplicate = await prisma.user.findUnique({ where: { email } });
      if (duplicate && duplicate.id !== id) {
        res.status(400).json({ error: 'Email already in use' });
        return;
      }
      data.email = email;
    }

    if ('name' in req.body) {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      data.name = name || null;
    }

    if ('isEmployee' in req.body) {
      data.isEmployee = parseIsEmployee(req.body?.isEmployee);
    }

    if ('isContractor' in req.body) {
      data.isContractor = parseIsContractor(req.body?.isContractor);
    }

    if ('employmentStatus' in req.body) {
      const raw = typeof req.body?.employmentStatus === 'string' ? req.body.employmentStatus.trim() : '';
      data.employmentStatus = raw.toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
    }

    if ('hourlyRate' in req.body) {
      const hourlyRateRaw = req.body?.hourlyRate;
      const hourlyRate =
        hourlyRateRaw === undefined || hourlyRateRaw === null || hourlyRateRaw === '' ? null : Number(hourlyRateRaw);
      if (hourlyRate !== null && (!Number.isFinite(hourlyRate) || hourlyRate < 0)) {
        res.status(400).json({ error: 'hourlyRate must be a non-negative number' });
        return;
      }
      data.hourlyRate = hourlyRate;
      if (hourlyRate !== null && !('currency' in req.body)) {
        data.currency = 'USD';
      }
    }

    if ('currency' in req.body) {
      data.currency = typeof req.body?.currency === 'string' ? req.body.currency.trim() || null : null;
    }

    /** When set, `UserAssignedCountry` rows are replaced after delete (keeps roster multi-country in sync). */
    let replaceAssignedCountries: string[] | undefined;
    if ('assignedCountryNames' in req.body) {
      const raw = req.body?.assignedCountryNames;
      if (raw !== null && !Array.isArray(raw)) {
        res.status(400).json({ error: 'assignedCountryNames must be an array of strings or null' });
        return;
      }
      const arr = raw === null ? [] : (raw as unknown[]);
      const names = [...new Set(arr.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean))];
      for (const n of names) {
        if (n.length > 128) {
          res.status(400).json({ error: 'Each country must be at most 128 characters' });
          return;
        }
      }
      if (names.length > 64) {
        res.status(400).json({ error: 'At most 64 countries per user' });
        return;
      }
      replaceAssignedCountries = names;
      data.country = names[0] ?? null;
    } else if ('country' in req.body) {
      data.country = typeof req.body?.country === 'string' ? req.body.country.trim() || null : null;
      replaceAssignedCountries = data.country ? [data.country] : [];
    }

    if ('employmentResponsibilities' in req.body) {
      const raw = req.body?.employmentResponsibilities;
      if (raw === null || raw === undefined) {
        data.employmentResponsibilities = null;
      } else if (typeof raw === 'string') {
        const t = raw.trim();
        data.employmentResponsibilities = t.length > 0 ? t.slice(0, 8000) : null;
      } else {
        res.status(400).json({ error: 'employmentResponsibilities must be a string or null' });
        return;
      }
    }

    if ('employmentNotes' in req.body) {
      const raw = req.body?.employmentNotes;
      if (raw === null || raw === undefined) {
        data.employmentNotes = null;
      } else if (typeof raw === 'string') {
        const t = raw.trim();
        data.employmentNotes = t.length > 0 ? t.slice(0, 8000) : null;
      } else {
        res.status(400).json({ error: 'employmentNotes must be a string or null' });
        return;
      }
    }

    if ('commodityTypeId' in req.body) {
      const raw = req.body?.commodityTypeId;
      if (raw === null || raw === undefined || raw === '') {
        data.commodityTypeId = null;
      } else if (typeof raw === 'string') {
        const ct = await prisma.commodityType.findUnique({ where: { id: raw.trim() } });
        if (!ct) {
          res.status(400).json({ error: 'Invalid commodity type' });
          return;
        }
        data.commodityTypeId = ct.id;
      } else {
        res.status(400).json({ error: 'commodityTypeId must be a string or null' });
        return;
      }
    }

    if ('password' in req.body) {
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!password.trim()) {
        res.status(400).json({ error: 'password cannot be empty' });
        return;
      }
      data.passwordHash = await bcrypt.hash(password, 10);
      data.passwordEncrypted = encryptPassword(password);
    }

    const roleNamesRaw = Array.isArray(req.body?.roleNames) ? (req.body.roleNames as unknown[]).map(String) : null;
    const roleNames = roleNamesRaw ? normalizeRoleNames(roleNamesRaw) : null;
    if (roleNames && roleNames.length === 0) {
      res.status(400).json({ error: 'roleNames cannot be empty' });
      return;
    }
    const roleResolution = roleNames ? await resolveRoleRows(roleNames) : null;
    const roleRows = roleResolution?.rows ?? null;
    if (roleNames && roleRows && (roleRows.length !== roleNames.length || (roleResolution?.missing.length ?? 0) > 0)) {
      res.status(400).json({ error: 'One or more role names are invalid' });
      return;
    }

    const updated = await prismaBase.$transaction(async (tx) => {
      if (roleNames && roleRows) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({ data: roleRows.map((r) => ({ userId: id, roleId: r.id })) });
      }
      if (replaceAssignedCountries !== undefined) {
        await tx.userAssignedCountry.deleteMany({ where: { userId: id } });
        if (replaceAssignedCountries.length > 0) {
          await tx.userAssignedCountry.createMany({
            data: replaceAssignedCountries.map((country) => ({ userId: id, country })),
          });
        }
      }
      return tx.user.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          passwordEncrypted: true,
          isEmployee: true,
          isContractor: true,
          employmentStatus: true,
          hourlyRate: true,
          currency: true,
          country: true,
          employmentResponsibilities: true,
          employmentNotes: true,
          commodityTypeId: true,
          commodityType: { select: { id: true, name: true } },
          createdAt: true,
          userRoles: { select: { role: { select: { id: true, name: true } } } },
          supplier: { select: { id: true, code: true, name: true } },
          buyerSuppliers: { select: { supplierId: true } },
          qeSuppliers: { select: { supplierId: true } },
          assignedCountries: { select: { country: true }, orderBy: { country: 'asc' } },
        },
      });
    });

    res.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      isEmployee: updated.isEmployee,
      isContractor: updated.isContractor,
      employmentStatus: updated.employmentStatus,
      hourlyRate: updated.hourlyRate,
      currency: updated.currency,
      country: updated.country,
      assignedCountryNames: assignedCountryNamesFromUser(updated),
      employmentResponsibilities: updated.employmentResponsibilities,
      employmentNotes: updated.employmentNotes,
      commodityTypeId: updated.commodityTypeId,
      commodityType: updated.commodityType ?? undefined,
      createdAt: updated.createdAt,
      passwordPlain: decryptPassword(updated.passwordEncrypted),
      roleNames: normalizeRoleNames(updated.userRoles.map((ur) => ur.role.name)),
      supplier: updated.supplier ?? undefined,
      assignedSupplierIds: updated.buyerSuppliers.map((b) => b.supplierId),
      qeAssignedSupplierIds: updated.qeSuppliers.map((q) => q.supplierId),
    });
  })
);

export default router;
