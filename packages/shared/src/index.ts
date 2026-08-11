export const permissions = {
  usersManage: 'users.manage',
  organizationsRead: 'organizations.read',
  organizationsManage: 'organizations.manage',
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
