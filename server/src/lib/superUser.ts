/**
 * Static Super account — not stored in the database.
 * Used for platform-level database connection control only.
 */
import { DEFAULT_PATH_ROLES } from './permissions';
import { verifySuperPassword } from './superUserCredentials';

export const SUPER_USER_ID = '__ssa_super__';
export const SUPER_USER_EMAIL = 'engineerfullstack2@gmail.com';
export const SUPER_USER_PASSWORD = '123';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isSuperUserEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return normalizeEmail(email) === SUPER_USER_EMAIL;
}

export function isSuperUserId(userId: string | null | undefined): boolean {
  return userId === SUPER_USER_ID;
}

export function isHiddenSuperUserEmail(email: string | null | undefined): boolean {
  return isSuperUserEmail(email);
}

export async function validateSuperCredentials(email: string, password: string): Promise<boolean> {
  if (!isSuperUserEmail(email)) return false;
  return verifySuperPassword(password);
}

/** Full path access for Super (includes database control page). */
export function buildSuperPathRoles(): Record<string, string[]> {
  const matrix: Record<string, string[]> = {
    ...DEFAULT_PATH_ROLES,
    '/product-hub': ['Super', 'Admin'],
    '/global-vendors/database': ['Super'],
  };
  for (const [path, roles] of Object.entries(matrix)) {
    if (!roles.includes('Super')) {
      matrix[path] = ['Super', ...roles];
    }
  }
  return matrix;
}

export function buildSuperAuthUser() {
  return {
    id: SUPER_USER_ID,
    email: SUPER_USER_EMAIL,
    name: 'Super',
    roleNames: ['Super', 'Admin'],
    pathRoles: buildSuperPathRoles(),
    isSuper: true as const,
  };
}
