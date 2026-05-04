/**
 * Email Sourcing Directors when a Global Supply PO is opened or closed in a country
 * that matches their Employee Assignments (UserAssignedCountry + legacy User.country).
 */
import { AlertCategory } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { sendTransactionalEmail } from '../lib/mail';

const CATEGORY: AlertCategory = 'sourcingDirectorPoCountryEmail';

function norm(s: string | null | undefined): string {
  return (s ?? '').trim();
}

function countriesMatch(a: string, b: string): boolean {
  return norm(a).toLowerCase() === norm(b).toLowerCase();
}

function assignedCountryList(user: {
  country: string | null;
  assignedCountries: { country: string }[];
}): string[] {
  const fromJunction = user.assignedCountries.map((c) => norm(c.country)).filter(Boolean);
  const legacy = norm(user.country);
  return [...new Set([...fromJunction, ...(legacy ? [legacy] : [])])];
}

function poCountry(po: {
  farmId: string | null;
  farm: { country: string } | null;
  destinationCountry: string | null;
}): string | null {
  const fc = po.farm?.country;
  if (fc && norm(fc)) return norm(fc);
  const d = norm(po.destinationCountry);
  return d || null;
}

export async function notifySourcingDirectorsOfPurchaseOrderEvent(params: {
  po: {
    id: string;
    code: string;
    status: string | null;
    farmId: string | null;
    buyerName: string;
    destinationCountry: string | null;
    farm: { country: string; farmName?: string } | null;
  };
  event: 'opened' | 'closed' | 'reopened';
}): Promise<void> {
  const { po, event } = params;
  const country = poCountry(po);
  if (!country) return;

  const directors = await prisma.user.findMany({
    where: {
      userRoles: { some: { role: { name: 'SourcingDirector' } } },
    },
    select: {
      id: true,
      email: true,
      name: true,
      country: true,
      assignedCountries: { select: { country: true } },
    },
  });
  if (directors.length === 0) return;

  const directorIds = directors.map((d) => d.id);
  const prefs = await prisma.userAlertPreference.findMany({
    where: { userId: { in: directorIds }, alertCategory: CATEGORY },
    select: { userId: true, enabled: true },
  });
  const prefByUser = new Map(prefs.map((p) => [p.userId, p.enabled]));

  const subjectVerb =
    event === 'opened' ? 'opened' : event === 'reopened' ? 'reopened' : 'closed';
  const subject = `[Global Supply] PO ${po.code} ${subjectVerb} (${country})`;

  for (const d of directors) {
    const assigned = assignedCountryList(d);
    if (assigned.length === 0) continue;
    if (!assigned.some((c) => countriesMatch(c, country))) continue;
    if (prefByUser.get(d.id) === false) continue;
    const to = norm(d.email);
    if (!to) continue;

    const farmLabel = po.farm?.farmName ? `${po.farm.farmName} (${country})` : country;
    const text = [
      `Purchase order ${po.code} was ${subjectVerb}.`,
      `Country: ${country}`,
      `Farm context: ${farmLabel}`,
      `Buyer: ${po.buyerName}`,
      `Status: ${norm(po.status) || '—'}`,
      '',
      'You received this because your Employee Assignments include this country and PO emails are enabled in Global Supply Admin → Email alerts.',
    ].join('\n');

    const html = `<p><strong>Purchase order ${escapeHtml(po.code)}</strong> was <strong>${subjectVerb}</strong>.</p>
<ul>
<li><strong>Country:</strong> ${escapeHtml(country)}</li>
<li><strong>Farm / context:</strong> ${escapeHtml(farmLabel)}</li>
<li><strong>Buyer:</strong> ${escapeHtml(po.buyerName)}</li>
<li><strong>Status:</strong> ${escapeHtml(norm(po.status) || '—')}</li>
</ul>
<p style="color:#555;font-size:14px">You received this because your Employee Assignments include this country and PO emails are enabled in Global Supply Admin → Email alerts.</p>`;

    // eslint-disable-next-line no-await-in-loop
    await sendTransactionalEmail({ to, subject, text, html }).catch(() => {
      /* avoid failing PO API if SMTP errors */
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
