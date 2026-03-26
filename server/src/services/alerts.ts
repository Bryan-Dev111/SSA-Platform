import { AlertCategory, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

type AlertRecipientUser = { id: string };

async function getEnabledRecipientIds(category: AlertCategory): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      userRoles: {
        some: {
          role: {
            name: { in: ['Admin', 'QualityEngineer', 'QualityManager', 'Buyer', 'Auditor'] },
          },
        },
      },
    },
    select: { id: true },
  });
  if (users.length === 0) return [];
  const prefs = await prisma.userAlertPreference.findMany({
    where: { alertCategory: category, userId: { in: users.map((u) => u.id) } },
    select: { userId: true, enabled: true },
  });
  const prefByUserId = new Map(prefs.map((p) => [p.userId, p.enabled]));
  return users.filter((u) => prefByUserId.get(u.id) !== false).map((u) => u.id);
}

export async function createAlertForRecipients(input: {
  category: AlertCategory;
  entityType: string;
  entityId?: string | null;
  message: string;
  recipients?: AlertRecipientUser[];
}): Promise<void> {
  const recipients = input.recipients ?? (await getEnabledRecipientIds(input.category)).map((id) => ({ id }));
  if (recipients.length === 0) return;
  const entityId = input.entityId ?? null;
  const existing = await prisma.alert.findMany({
    where: {
      category: input.category,
      entityType: input.entityType,
      entityId,
      userId: { in: recipients.map((r) => r.id) },
    },
    select: { userId: true },
  });
  const existingUserIds = new Set(existing.map((e) => e.userId).filter((v): v is string => Boolean(v)));
  const createManyData: Prisma.AlertCreateManyInput[] = recipients
    .filter((r) => !existingUserIds.has(r.id))
    .map((r) => ({
      category: input.category,
      entityType: input.entityType,
      entityId,
      message: input.message,
      userId: r.id,
    }));
  if (createManyData.length > 0) {
    await prisma.alert.createMany({ data: createManyData });
  }
}

export async function backfillOverdueAuditAlerts(): Promise<void> {
  const overdueAudits = await prisma.audit.findMany({
    where: { result: null, auditDate: { lt: new Date() } },
    select: { id: true, code: true, supplier: { select: { code: true, name: true } } },
    take: 200,
  });
  for (const audit of overdueAudits) {
    // eslint-disable-next-line no-await-in-loop
    await createAlertForRecipients({
      category: 'overdueAudit',
      entityType: 'Audit',
      entityId: audit.id,
      message: `Overdue audit ${audit.code} for ${audit.supplier.code} — ${audit.supplier.name}.`,
    });
  }
}

export async function backfillOverdueCarAlerts(): Promise<void> {
  const overdueCars = await prisma.correctiveAction.findMany({
    where: {
      status: { not: 'Closed' },
      targetCompletionDate: { lt: new Date() },
    },
    select: { id: true, code: true, supplier: { select: { code: true, name: true } } },
    take: 200,
  });
  for (const car of overdueCars) {
    // eslint-disable-next-line no-await-in-loop
    await createAlertForRecipients({
      category: 'overdueCAR',
      entityType: 'CAR',
      entityId: car.id,
      message: `Overdue CAR ${car.code} for ${car.supplier.code} — ${car.supplier.name}.`,
    });
  }
}

export async function backfillLateShipmentAlerts(): Promise<void> {
  const lateShipments = await prisma.shipment.findMany({
    where: {
      status: 'WaitingInspection',
      inspectionDate: { lt: new Date() },
    },
    select: {
      id: true,
      purchaseOrder: true,
      supplier: { select: { code: true, name: true } },
    },
    take: 200,
  });
  for (const shipment of lateShipments) {
    // eslint-disable-next-line no-await-in-loop
    await createAlertForRecipients({
      category: 'lateShipment',
      entityType: 'Shipment',
      entityId: shipment.id,
      message: `Late shipment ${shipment.purchaseOrder || shipment.id} for ${shipment.supplier.code} — ${shipment.supplier.name}.`,
    });
  }
}
