import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const permissionCodes = [
  'users.manage',
  'organizations.read',
  'organizations.manage',
  'auctions.read',
  'auctions.create',
  'auctions.update',
  'auctions.publish',
  'bids.read',
  'bids.submit',
  'bids.evaluate',
  'contracts.read',
  'contracts.create',
  'contracts.approve',
  'reports.read',
  'reports.export',
  'audit.read',
] as const;

const roles = [
  'SUPER_ADMIN',
  'CNE_ADMIN',
  'AUCTION_MANAGER',
  'TECHNICAL_EVALUATOR',
  'FINANCIAL_EVALUATOR',
  'REGULATORY_SUPERVISOR',
  'AUDITOR',
  'COMPANY_ADMIN',
  'COMPANY_REPRESENTATIVE',
  'READ_ONLY',
] as const;

async function main(): Promise<void> {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD es obligatorio y debe tener al menos 12 caracteres.');
  }

  const createdPermissions = await Promise.all(
    permissionCodes.map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: `Permiso del sistema: ${code}` },
      }),
    ),
  );

  const createdRoles = await Promise.all(
    roles.map((code) =>
      prisma.role.upsert({
        where: { code },
        update: {},
        create: { code, name: code.replaceAll('_', ' '), isSystem: true },
      }),
    ),
  );

  const superAdmin = createdRoles.find((role) => role.code === 'SUPER_ADMIN');
  if (!superAdmin) throw new Error('No se pudo crear el rol SUPER_ADMIN.');

  await Promise.all(
    createdPermissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: superAdmin.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: superAdmin.id, permissionId: permission.id },
      }),
    ),
  );

  const existingCne = await prisma.organization.findFirst({
    where: { legalName: 'Comisión Nacional de Energía' },
  });
  const cne =
    existingCne ??
    (await prisma.organization.create({
      data: {
        legalName: 'Comisión Nacional de Energía',
        commercialName: 'CNE',
        type: 'REGULATORY_AUTHORITY',
        status: 'APPROVED',
      },
    }));

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ecosoft.com.do' },
    update: {},
    create: {
      email: 'admin@ecosoft.com.do',
      passwordHash: await bcrypt.hash(password, 12),
      firstName: 'Administrador',
      lastName: 'EcoSoft',
      status: 'ACTIVE',
      emailConfirmedAt: new Date(),
      organizationId: cne.id,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdmin.id } },
    update: {},
    create: { userId: admin.id, roleId: superAdmin.id },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
