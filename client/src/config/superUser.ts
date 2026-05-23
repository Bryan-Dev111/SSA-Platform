/** Static Super account email (must match server). */
export const SUPER_USER_EMAIL = 'engineerfullstack2@gmail.com';

export function isSuperUserEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_USER_EMAIL;
}
