/**
 * JWT auth middleware: verify token and attach req.user
 */
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { buildSuperAuthUser, isSuperUserId } from '../lib/superUser';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export interface JwtPayload {
  userId: string;
  email: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (isSuperUserId(decoded.userId)) {
      const superUser = buildSuperAuthUser();
      (req as Request).user = {
        id: superUser.id,
        email: superUser.email,
        name: superUser.name,
        roleNames: superUser.roleNames,
        roleIds: [],
      };
      next();
      return;
    }
    loadUser(decoded.userId)
      .then((user) => {
        (req as Request).user = user;
        next();
      })
      .catch(() => {
        res.status(401).json({ error: 'User not found' });
      });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Optional auth: attach user if token present, else continue without user */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (isSuperUserId(decoded.userId)) {
      const superUser = buildSuperAuthUser();
      (req as Request).user = {
        id: superUser.id,
        email: superUser.email,
        name: superUser.name,
        roleNames: superUser.roleNames,
        roleIds: [],
      };
      next();
      return;
    }
    loadUser(decoded.userId)
      .then((user) => {
        (req as Request).user = user;
        next();
      })
      .catch(() => next());
  } catch {
    next();
  }
}

async function loadUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: { include: { role: true } },
      supplier: true,
      buyerSuppliers: true,
    },
  });
  if (!user) throw new Error('User not found');
  const roleNames = user.userRoles.map((ur) => ur.role.name);
  const roleIds = user.userRoles.map((ur) => ur.roleId);
  const supplierId = user.supplier?.id ?? null;
  const buyerId = user.buyerSuppliers.length ? user.id : null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleNames,
    roleIds,
    buyerId: buyerId ?? undefined,
    supplierId: supplierId ?? undefined,
  };
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
