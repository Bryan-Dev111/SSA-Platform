/**
 * RBAC: requireRole, requirePageAccess
 * Use after authMiddleware so req.user is set.
 */
import type { Request, Response, NextFunction } from 'express';
import { getApiPageRolesMatrix } from '../lib/permissions';

/**
 * Role names that can access API routes using `requirePageAccess(pageKey)`.
 * Keep aligned with `client/src/config/rolePageAccess.ts` (paths) for the same features.
 */
export const API_PAGE_ROLES: Record<string, string[]> = {
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
  GlobalSupplyFarmers: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  GlobalSupplyApproved: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  GlobalSupplyMap: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  GlobalSupplyRelationship: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  GlobalSupplyPurchaseOrders: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  GlobalSupplySamples: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  GlobalSupplyExpenses: ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Buyer'],
  Login: [], // all (no check)
};

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const hasRole = req.user.roleNames.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export function requirePageAccess(pageName: string) {
  if (!API_PAGE_ROLES[pageName]) {
    return (_req: Request, res: Response, _next: NextFunction): void => {
      res.status(403).json({ error: 'Unknown page' });
    };
  }
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const liveMap = await getApiPageRolesMatrix();
      const allowedRoles = liveMap[pageName] ?? [];
      if (allowedRoles.length === 0) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      const hasRole = req.user.roleNames.some((r) => allowedRoles.includes(r));
      if (!hasRole) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Allow the request if the user has access to any of the listed pages (OR). */
export function requirePageAccessAny(pageNames: string[]) {
  const unknown = pageNames.filter((n) => !API_PAGE_ROLES[n]);
  if (unknown.length > 0) {
    return (_req: Request, res: Response, _next: NextFunction): void => {
      res.status(403).json({ error: 'Unknown page' });
    };
  }
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const liveMap = await getApiPageRolesMatrix();
      const ok = pageNames.some((pageName) => {
        const allowedRoles = liveMap[pageName] ?? [];
        return (
          allowedRoles.length > 0 && req.user!.roleNames.some((r) => allowedRoles.includes(r))
        );
      });
      if (!ok) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
