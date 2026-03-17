/**
 * Sentinel — Seed: roles + optional Admin user
 * Run: npx prisma db seed
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ROLES = [
  'Admin',
  'Viewer',
  'QualityEngineer',
  'Auditor',
  'Buyer',
  'Supplier',
] as const;

async function main() {
  console.log('Seeding roles...');
  for (const name of ROLES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log('Roles seeded.');

  const adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } });
  if (!adminRole) throw new Error('Admin role not found');

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@sentinel.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existing) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'Admin User',
      },
    });
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: admin.id, roleId: adminRole.id },
      },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });
    console.log(`Admin user created: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  // Day 4 test users (one per role) — password: Test123!
  const testPassword = await bcrypt.hash('Test123!', 10);
  const testUsers = [
    { email: 'viewer@sentinel.local', name: 'Viewer User', role: 'Viewer' },
    { email: 'qe@sentinel.local', name: 'QE User', role: 'QualityEngineer' },
    { email: 'auditor@sentinel.local', name: 'Auditor User', role: 'Auditor' },
    { email: 'buyer@sentinel.local', name: 'Buyer User', role: 'Buyer' },
    { email: 'supplier@sentinel.local', name: 'Supplier User', role: 'Supplier' },
  ];
  for (const tu of testUsers) {
    const role = await prisma.role.findUnique({ where: { name: tu.role } });
    if (!role) throw new Error(`Role not found: ${tu.role}. Run seed after migrations.`);
    const existingUser = await prisma.user.findUnique({ where: { email: tu.email } });
    let user: { id: string; email: string };
    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { passwordHash: testPassword, name: tu.name },
      });
      user = existingUser;
      console.log(`Test user updated (password reset): ${tu.email} (${tu.role})`);
    } else {
      user = await prisma.user.create({
        data: { email: tu.email, passwordHash: testPassword, name: tu.name },
      });
      console.log(`Test user created: ${tu.email} (${tu.role})`);
    }
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: user.id, roleId: role.id },
      },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
    if (tu.role === 'Supplier') {
      const sup = await prisma.supplier.upsert({
        where: { code: 'SUP-TEST01' },
        update: { userId: user.id },
        create: { code: 'SUP-TEST01', name: 'Test Supplier', userId: user.id },
      });
      if (!sup.userId) {
        await prisma.supplier.update({
          where: { id: sup.id },
          data: { userId: user.id },
        });
      }
    }
  }

  // Mock suppliers for test (3 total): SUP-TEST01 already created above for Supplier user
  const mockSuppliers = [
    { code: 'SUP-TEST01', name: 'Test Supplier', city: 'Shanghai', country: 'China' },
    { code: 'SUP-TEST02', name: 'Pacific Manufacturing Co.', city: 'Ho Chi Minh City', country: 'Vietnam' },
    { code: 'SUP-TEST03', name: 'Global Parts Ltd.', city: 'Guadalajara', country: 'Mexico' },
  ];
  for (const s of mockSuppliers) {
    await prisma.supplier.upsert({
      where: { code: s.code },
      update: { name: s.name, city: s.city, country: s.country },
      create: { code: s.code, name: s.name, city: s.city, country: s.country },
    });
  }
  console.log('Mock suppliers seeded (3): SUP-TEST01, SUP-TEST02, SUP-TEST03.');

  // Day 5: Assign buyer to test supplier so Buyer scope can be tested on Supplier List
  const buyer = await prisma.user.findUnique({ where: { email: 'buyer@sentinel.local' } });
  const testSupplier = await prisma.supplier.findUnique({ where: { code: 'SUP-TEST01' } });
  if (buyer && testSupplier) {
    await prisma.buyerSupplier.upsert({
      where: {
        buyerId_supplierId: { buyerId: buyer.id, supplierId: testSupplier.id },
      },
      update: {},
      create: { buyerId: buyer.id, supplierId: testSupplier.id },
    });
    console.log('Buyer assigned to SUP-TEST01 for scope testing.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
