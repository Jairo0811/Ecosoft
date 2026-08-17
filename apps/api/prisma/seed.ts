import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const permissionCodes = [
  'users.manage',
  'organizations.read',
  'organizations.manage',
  'organizations.approve',
  'catalogs.read',
  'catalogs.manage',
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
  'analytics.read',
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

const rolePermissionCodes: Record<
  (typeof roles)[number],
  readonly (typeof permissionCodes)[number][]
> = {
  SUPER_ADMIN: permissionCodes,
  CNE_ADMIN: permissionCodes,
  AUCTION_MANAGER: [
    'organizations.read',
    'catalogs.read',
    'auctions.read',
    'auctions.create',
    'auctions.update',
    'auctions.publish',
    'reports.read',
    'analytics.read',
  ],
  TECHNICAL_EVALUATOR: [
    'organizations.read',
    'catalogs.read',
    'auctions.read',
    'bids.read',
    'bids.evaluate',
    'reports.read',
    'analytics.read',
  ],
  FINANCIAL_EVALUATOR: [
    'organizations.read',
    'catalogs.read',
    'auctions.read',
    'bids.read',
    'bids.evaluate',
    'reports.read',
    'analytics.read',
  ],
  REGULATORY_SUPERVISOR: [
    'organizations.read',
    'organizations.approve',
    'catalogs.read',
    'auctions.read',
    'bids.read',
    'contracts.read',
    'reports.read',
    'analytics.read',
    'audit.read',
  ],
  AUDITOR: [
    'organizations.read',
    'catalogs.read',
    'auctions.read',
    'bids.read',
    'contracts.read',
    'reports.read',
    'analytics.read',
    'audit.read',
  ],
  COMPANY_ADMIN: [
    'users.manage',
    'organizations.read',
    'catalogs.read',
    'auctions.read',
    'bids.read',
    'bids.submit',
    'contracts.read',
    'reports.read',
    'analytics.read',
  ],
  COMPANY_REPRESENTATIVE: [
    'organizations.read',
    'catalogs.read',
    'auctions.read',
    'bids.read',
    'bids.submit',
    'contracts.read',
    'reports.read',
    'analytics.read',
  ],
  READ_ONLY: [
    'organizations.read',
    'catalogs.read',
    'auctions.read',
    'contracts.read',
    'reports.read',
    'analytics.read',
  ],
};

const catalogItems = [
  { type: 'ENERGY_TECHNOLOGY', code: 'SOLAR', name: 'Solar fotovoltaica', sortOrder: 10 },
  { type: 'ENERGY_TECHNOLOGY', code: 'WIND', name: 'Eólica', sortOrder: 20 },
  { type: 'ENERGY_TECHNOLOGY', code: 'HYDRO', name: 'Hidroeléctrica', sortOrder: 30 },
  { type: 'ENERGY_TECHNOLOGY', code: 'BIOMASS', name: 'Biomasa', sortOrder: 40 },
  { type: 'CURRENCY', code: 'DOP', name: 'Peso dominicano', sortOrder: 10 },
  { type: 'CURRENCY', code: 'USD', name: 'Dólar estadounidense', sortOrder: 20 },
  {
    type: 'TIME_ZONE',
    code: 'AMERICA_SANTO_DOMINGO',
    name: 'America/Santo_Domingo',
    sortOrder: 10,
  },
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

  const permissionByCode = new Map(
    createdPermissions.map((permission) => [permission.code, permission]),
  );
  await Promise.all(
    createdRoles.flatMap((role) =>
      rolePermissionCodes[role.code as (typeof roles)[number]].map((permissionCode) => {
        const permission = permissionByCode.get(permissionCode);
        if (!permission) throw new Error(`No se pudo crear el permiso ${permissionCode}.`);
        return prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
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

  await Promise.all(
    catalogItems.map((item) =>
      prisma.catalogItem.upsert({
        where: { type_code: { type: item.type, code: item.code } },
        update: { name: item.name, sortOrder: item.sortOrder },
        create: item,
      }),
    ),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
