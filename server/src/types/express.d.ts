/**
 * Extend Express Request with user set by auth middleware
 */
import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  roleNames: string[];
  roleIds: string[];
  buyerId?: string | null;
  supplierId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
