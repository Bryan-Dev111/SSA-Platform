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
