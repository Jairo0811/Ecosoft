export const permissions = {
  usersManage: 'users.manage',
  organizationsRead: 'organizations.read',
  organizationsManage: 'organizations.manage',
  organizationsApprove: 'organizations.approve',
  catalogsRead: 'catalogs.read',
  catalogsManage: 'catalogs.manage',
  auctionsRead: 'auctions.read',
  auctionsCreate: 'auctions.create',
  auctionsUpdate: 'auctions.update',
  auctionsPublish: 'auctions.publish',
  bidsRead: 'bids.read',
  bidsSubmit: 'bids.submit',
  bidsEvaluate: 'bids.evaluate',
  documentsRead: 'documents.read',
  documentsManage: 'documents.manage',
  evaluationsRead: 'evaluations.read',
  evaluationsSubmit: 'evaluations.submit',
  evaluationsManage: 'evaluations.manage',
  awardsRead: 'awards.read',
  awardsManage: 'awards.manage',
  awardsApprove: 'awards.approve',
  projectsRead: 'projects.read',
  projectsManage: 'projects.manage',
  contractsRead: 'contracts.read',
  contractsCreate: 'contracts.create',
  contractsApprove: 'contracts.approve',
  aiUse: 'ai.use',
  aiReview: 'ai.review',
  reportsRead: 'reports.read',
  reportsExport: 'reports.export',
  analyticsRead: 'analytics.read',
  auditRead: 'audit.read',
  regulatoryRead: 'regulatory.read',
  regulatoryManage: 'regulatory.manage',
  notificationsRead: 'notifications.read',
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
  authVersion: number;
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

export const auctionStatuses = [
  'BORRADOR',
  'PROGRAMADA',
  'PUBLICADA',
  'ABIERTA',
  'CERRADA',
  'EN_EVALUACION',
  'ADJUDICADA',
  'CANCELADA',
  'FINALIZADA',
] as const;

export type AuctionStatus = (typeof auctionStatuses)[number];

export const bidStatuses = [
  'BORRADOR',
  'ENVIADA',
  'RETIRADA',
  'EN_EVALUACION',
  'ADJUDICADA',
  'NO_SELECCIONADA',
] as const;
export type BidStatus = (typeof bidStatuses)[number];

export const evaluationTypes = ['TECNICA', 'FINANCIERA'] as const;
export type EvaluationType = (typeof evaluationTypes)[number];

export const evaluationStatuses = ['BORRADOR', 'ENVIADA'] as const;
export type EvaluationStatus = (typeof evaluationStatuses)[number];

export const awardStatuses = ['BORRADOR', 'APROBADA', 'RECHAZADA'] as const;
export type AwardStatus = (typeof awardStatuses)[number];

export const projectStatuses = [
  'PROPUESTO',
  'EN_DESARROLLO',
  'EN_CONSTRUCCION',
  'OPERATIVO',
  'SUSPENDIDO',
  'FINALIZADO',
] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const contractStatuses = [
  'BORRADOR',
  'PENDIENTE_FIRMA',
  'VIGENTE',
  'SUSPENDIDO',
  'VENCIDO',
  'CANCELADO',
] as const;
export type ContractStatus = (typeof contractStatuses)[number];

export const documentEntityTypes = [
  'AUCTION',
  'BID',
  'EVALUATION',
  'AWARD',
  'PPA_CONTRACT',
  'ENERGY_PROJECT',
  'REGULATION',
] as const;
export type DocumentEntityType = (typeof documentEntityTypes)[number];

export const aiOperations = ['OCR', 'SUMMARY', 'ANOMALY_REVIEW'] as const;
export type AIOperation = (typeof aiOperations)[number];

export const calendarEventTypes = [
  'APERTURA',
  'CIERRE',
  'EVALUACION',
  'REUNION',
  'ADJUDICACION',
  'VENCIMIENTO',
  'FIRMA',
  'RENOVACION',
  'HITO',
] as const;

export type CalendarEventType = (typeof calendarEventTypes)[number];

export const regulationTypes = ['NORMATIVA', 'RESOLUCION', 'REGLAMENTO'] as const;
export type RegulationType = (typeof regulationTypes)[number];

export const regulationStatuses = ['BORRADOR', 'VIGENTE', 'SUSPENDIDA', 'DEROGADA'] as const;
export type RegulationStatus = (typeof regulationStatuses)[number];

export const regulationScopeTypes = [
  'AUCTION',
  'PPA_CONTRACT',
  'ENERGY_PROJECT',
  'EVALUATION',
] as const;
export type RegulationScopeType = (typeof regulationScopeTypes)[number];

export const notificationSeverities = ['INFO', 'WARNING', 'CRITICAL'] as const;
export type NotificationSeverity = (typeof notificationSeverities)[number];
