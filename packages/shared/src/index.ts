export const permissions = {
  usersManage: 'users.manage',
  organizationsRead: 'organizations.read',
  organizationsManage: 'organizations.manage',
  organizationsApprove: 'organizations.approve',
  catalogsRead: 'catalogs.read',
  catalogsManage: 'catalogs.manage',
  auctionsRead: 'auctions.read',
  auctionsCreate: 'auctions.create',
  auctionsPublish: 'auctions.publish',
  bidsRead: 'bids.read',
  bidsSubmit: 'bids.submit',
  bidsEvaluate: 'bids.evaluate',
  contractsRead: 'contracts.read',
  contractsCreate: 'contracts.create',
  contractsApprove: 'contracts.approve',
  reportsRead: 'reports.read',
  reportsExport: 'reports.export',
  auditRead: 'audit.read',
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions];

export interface ApiErrorResponse {
  code: string;
  message: string;
  correlationId: string;
  details?: unknown;
}

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string | null;
  roles: string[];
  permissions: string[];
}

export const organizationTypes = [
  'REGULATORY_AUTHORITY',
  'GENERATION_COMPANY',
  'DISTRIBUTION_COMPANY',
  'ENERGY_MARKETER',
  'FINANCIAL_INSTITUTION',
  'CONSULTING_FIRM',
  'OTHER',
] as const;

export type OrganizationType = (typeof organizationTypes)[number];

export const organizationStatuses = [
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
] as const;

export type OrganizationStatus = (typeof organizationStatuses)[number];

export const catalogTypes = [
  'ENERGY_TECHNOLOGY',
  'CURRENCY',
  'TIME_ZONE',
  'PROJECT_STATUS',
  'DOCUMENT_TYPE',
] as const;

export type CatalogType = (typeof catalogTypes)[number];
