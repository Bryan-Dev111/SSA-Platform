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
  Records: ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer', 'Supplier'],
  Shipments: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'Supplier', 'Auditor', 'Inspector'],
  Documents: ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor'],
  WorkLogs: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'Auditor'],
  InternalManagement: ['Admin', 'QualityManager'],
  Admin: ['Admin'],
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
      let allowedRoles = liveMap[pageName] ?? [];
      if (allowedRoles.length === 0) {
        allowedRoles = API_PAGE_ROLES[pageName] ?? [];
      }
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
        let allowedRoles = liveMap[pageName] ?? [];
        if (allowedRoles.length === 0) allowedRoles = API_PAGE_ROLES[pageName] ?? [];
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
