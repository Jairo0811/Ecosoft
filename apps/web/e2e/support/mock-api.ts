import type { Page, Route } from '@playwright/test';

/**
 * Deterministic in-browser double of the EcoSoft API for UI tests. It keeps two identities in
 * different organizations, issues per-identity access tokens and a simulated httpOnly refresh
 * cookie, and records which identity every request was made with. It does NOT replace the
 * backend tests: authorization is verified against the real API + SQL Server in CI.
 */

const API = 'http://localhost:4000/api/v1';
const ORIGIN = 'http://127.0.0.1:5173';

export type UserKey = 'A' | 'B';

const ORG_CNE = '0b6f5c8e-1d2a-4c3b-9e8f-111111111111';
const ORG_SOLAR = '0b6f5c8e-1d2a-4c3b-9e8f-222222222222';

const permissionsA = [
  'users.manage', 'organizations.read', 'organizations.manage', 'organizations.approve',
  'catalogs.read', 'catalogs.manage', 'auctions.read', 'auctions.create', 'auctions.update',
  'auctions.publish', 'bids.read', 'documents.read', 'documents.manage', 'evaluations.read',
  'evaluations.manage', 'awards.read', 'awards.manage', 'projects.read', 'projects.manage',
  'contracts.read', 'contracts.create', 'ai.use', 'ai.review', 'reports.read', 'reports.export',
  'analytics.read', 'audit.read', 'regulatory.read', 'regulatory.manage', 'notifications.read',
];
const permissionsB = [
  'users.manage', 'organizations.read', 'catalogs.read', 'auctions.read', 'bids.read',
  'bids.submit', 'documents.read', 'documents.manage', 'evaluations.read', 'awards.read',
  'projects.read', 'projects.manage', 'contracts.read', 'ai.use', 'reports.read',
  'analytics.read', 'regulatory.read', 'notifications.read',
];

export const identities = {
  A: {
    email: 'ana.martinez@cne.gob.do',
    password: 'Clave-Segura-A1!',
    user: {
      id: 'aaaaaaaa-0000-4000-8000-000000000001',
      email: 'ana.martinez@cne.gob.do',
      firstName: 'Ana',
      lastName: 'Martínez',
      organizationId: ORG_CNE,
      authVersion: 1,
      roles: ['CNE_ADMIN'],
      permissions: permissionsA,
    },
  },
  B: {
    email: 'bruno.pena@solarcaribe.do',
    password: 'Clave-Segura-B2!',
    user: {
      id: 'bbbbbbbb-0000-4000-8000-000000000002',
      email: 'bruno.pena@solarcaribe.do',
      firstName: 'Bruno',
      lastName: 'Peña',
      organizationId: ORG_SOLAR,
      authVersion: 1,
      roles: ['COMPANY_ADMIN'],
      permissions: permissionsB,
    },
  },
} as const;

const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const auctionsSeed = () => [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    code: 'SUB-2026-001',
    title: 'Subasta solar región norte',
    description: null,
    status: 'ABIERTA',
    renewableTechnologyCode: 'SOLAR',
    currencyCode: 'USD',
    capacityMw: '150',
    maximumPrice: '82.5',
    openAt: iso(-10),
    closeAt: iso(5),
    evaluationStartAt: null,
    awardPlannedAt: null,
    managingOrganization: { id: ORG_CNE, legalName: 'Comisión Nacional de Energía', commercialName: 'CNE', type: 'REGULATORY_AUTHORITY' },
    requirements: [
      { code: 'GARANTIA', title: 'Garantía de seriedad de oferta', category: 'FINANCIERO', isMandatory: true, sortOrder: 10 },
      { code: 'ESTUDIO_TECNICO', title: 'Estudio técnico de interconexión', category: 'TECNICO', isMandatory: true, sortOrder: 20 },
    ],
    participants: [{ status: 'HABILITADO', organization: { id: ORG_SOLAR, legalName: 'Solar Caribe S.R.L.', commercialName: 'Solar Caribe' } }],
    _count: { requirements: 2, participants: 1, events: 2 },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    code: 'SUB-2026-002',
    title: 'Subasta eólica Montecristi',
    description: null,
    status: 'PROGRAMADA',
    renewableTechnologyCode: 'WIND',
    currencyCode: 'USD',
    capacityMw: '90',
    maximumPrice: null,
    openAt: iso(12),
    closeAt: iso(40),
    evaluationStartAt: null,
    awardPlannedAt: null,
    managingOrganization: { id: ORG_CNE, legalName: 'Comisión Nacional de Energía', commercialName: 'CNE', type: 'REGULATORY_AUTHORITY' },
    requirements: [],
    participants: [],
    _count: { requirements: 0, participants: 0, events: 0 },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    code: 'SUB-2025-014',
    title: 'Subasta hidroeléctrica de pequeña escala',
    description: null,
    status: 'EN_EVALUACION',
    renewableTechnologyCode: 'HYDRO',
    currencyCode: 'DOP',
    capacityMw: '35.5',
    maximumPrice: '4900',
    openAt: iso(-60),
    closeAt: iso(-20),
    evaluationStartAt: iso(-18),
    awardPlannedAt: iso(15),
    managingOrganization: { id: ORG_CNE, legalName: 'Comisión Nacional de Energía', commercialName: 'CNE', type: 'REGULATORY_AUTHORITY' },
    requirements: [],
    participants: [],
    _count: { requirements: 0, participants: 0, events: 1 },
  },
];

const dashboardFor = (key: UserKey) =>
  key === 'A'
    ? {
        filters: { from: null, to: null, organizationId: null, technology: null },
        kpis: {
          activeAuctions: 2, pendingAuctions: 1, participantOrganizations: 7, bidsReceived: 18,
          contracts: 12, activeContracts: 9, auctionedMw: 275.5, offeredMw: 412.75, awardedMw: 160,
          operationalMw: 96.4, operationalContractedMw: 80, operationalProjects: 4,
          approvedAwards: 5, expiringContracts: 2,
        },
        capacityByTechnology: [
          { technology: 'SOLAR', installedMw: 64.4, contractedMw: 55 },
          { technology: 'WIND', installedMw: 22, contractedMw: 18 },
          { technology: 'HYDRO', installedMw: 10, contractedMw: 7 },
        ],
        projectsByProvince: [],
        auctionsByStatus: [
          { status: 'ABIERTA', auctions: 1, capacityMw: 150 },
          { status: 'PROGRAMADA', auctions: 1, capacityMw: 90 },
          { status: 'EN_EVALUACION', auctions: 1, capacityMw: 35.5 },
          { status: 'ADJUDICADA', auctions: 3, capacityMw: 160 },
        ],
        averageAwardPriceByCurrency: [{ currency: 'USD', price: 74.2 }],
        contractedValueByCurrency: [{ currency: 'USD', value: 12_500_000, contracts: 9 }],
        trend: ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].map(
          (month, index) => ({ month, auctionedMw: [0, 40, 0, 35.5, 0, 0, 150, 0, 0, 90, 0, 0][index] ?? 0, awardedMw: [0, 0, 30, 0, 40, 0, 0, 60, 30, 0, 0, 0][index] ?? 0 }),
        ),
        upcomingEvents: [
          { id: 'e1', title: 'Cierre de recepción SUB-2026-001', type: 'CIERRE', startsAt: iso(5), endsAt: null },
          { id: 'e2', title: 'Apertura SUB-2026-002', type: 'APERTURA', startsAt: iso(12), endsAt: null },
        ],
        alerts: {
          closingAuctions: [{ id: 'a1000000-0000-4000-8000-000000000001', code: 'SUB-2026-001', title: 'Subasta solar región norte', closeAt: iso(5) }],
          expiringContracts: [{ id: 'c1', contractNumber: 'PPA-2016-004', endDate: iso(45), organization: { legalName: 'Hidro Jimenoa S.A.', commercialName: null } }],
        },
        recentActivity: [
          { id: 'r1', action: 'STATUS_CHANGE', module: 'AUCTIONS', entity: 'Auction', result: 'SUCCESS', createdAt: iso(-0.05), user: { firstName: 'Ana', lastName: 'Martínez' } },
          { id: 'r2', action: 'UPLOAD', module: 'DOCUMENTS', entity: 'Document', result: 'SUCCESS', createdAt: iso(-0.3), user: { firstName: 'Bruno', lastName: 'Peña' } },
          { id: 'r3', action: 'LOGIN', module: 'Identity', entity: null, result: 'DENIED', createdAt: iso(-1), user: null },
        ],
      }
    : {
        filters: { from: null, to: null, organizationId: ORG_SOLAR, technology: null },
        kpis: {
          activeAuctions: 1, pendingAuctions: 0, participantOrganizations: 1, bidsReceived: 2,
          contracts: 1, activeContracts: 1, auctionedMw: 150, offeredMw: 60, awardedMw: 0,
          operationalMw: 0, operationalContractedMw: 0, operationalProjects: 0,
          approvedAwards: 0, expiringContracts: 0,
        },
        capacityByTechnology: [{ technology: 'SOLAR', installedMw: 25, contractedMw: 0 }],
        projectsByProvince: [],
        auctionsByStatus: [{ status: 'ABIERTA', auctions: 1, capacityMw: 150 }],
        averageAwardPriceByCurrency: [],
        contractedValueByCurrency: [],
        trend: [],
        upcomingEvents: [],
        alerts: { closingAuctions: [], expiringContracts: [] },
        recentActivity: [],
      };

const bidsSeed = () => [
  {
    id: 'b1000000-0000-4000-8000-000000000001',
    auctionId: 'a1000000-0000-4000-8000-000000000001',
    organizationId: ORG_SOLAR,
    projectName: 'Parque solar Baní II',
    status: 'BORRADOR',
    renewableTechnologyCode: 'SOLAR',
    offeredPowerMw: '40',
    estimatedEnergyMwh: '78000',
    offeredPrice: '79.9',
    currencyCode: 'USD',
    validUntil: iso(60),
    submittedAt: null,
    auction: { id: 'a1000000-0000-4000-8000-000000000001', code: 'SUB-2026-001', title: 'Subasta solar región norte', status: 'ABIERTA', closeAt: iso(5) },
    organization: { id: ORG_SOLAR, legalName: 'Solar Caribe S.R.L.', commercialName: 'Solar Caribe' },
  },
  {
    id: 'b1000000-0000-4000-8000-000000000002',
    auctionId: 'a1000000-0000-4000-8000-000000000001',
    organizationId: ORG_SOLAR,
    projectName: 'Parque solar Azua',
    status: 'ENVIADA',
    renewableTechnologyCode: 'SOLAR',
    offeredPowerMw: '20',
    estimatedEnergyMwh: '39000',
    offeredPrice: '81.2',
    currencyCode: 'USD',
    validUntil: iso(60),
    submittedAt: iso(-2),
    auction: { id: 'a1000000-0000-4000-8000-000000000001', code: 'SUB-2026-001', title: 'Subasta solar región norte', status: 'ABIERTA', closeAt: iso(5) },
    organization: { id: ORG_SOLAR, legalName: 'Solar Caribe S.R.L.', commercialName: 'Solar Caribe' },
  },
];

const documentsSeed = () => [
  {
    id: 'd1000000-0000-4000-8000-000000000001',
    organizationId: ORG_SOLAR,
    entityType: 'BID',
    entityId: 'b1000000-0000-4000-8000-000000000001',
    documentType: 'GARANTIA',
    title: 'Garantía de seriedad — Baní II',
    confidentiality: 'PRIVATE',
    status: 'ACTIVE',
    currentVersionNumber: 2,
    createdAt: iso(-4),
    updatedAt: iso(-1),
    createdBy: { firstName: 'Bruno', lastName: 'Peña', email: 'bruno.pena@solarcaribe.do' },
    versions: [
      { id: 'v2', versionNumber: 2, originalFileName: 'garantía-baní-ii.pdf', mimeType: 'application/pdf', sizeBytes: 182_340, sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', createdAt: iso(-1) },
      { id: 'v1', versionNumber: 1, originalFileName: 'garantia.pdf', mimeType: 'application/pdf', sizeBytes: 150_002, sha256: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae', createdAt: iso(-4) },
    ],
  },
];

interface RecordedRequest {
  method: string;
  path: string;
  identity: UserKey | null;
}

type Handler = (route: Route, context: { body: unknown; identity: UserKey | null; url: URL }) => Promise<void> | void;

export class MockApi {
  readonly requests: RecordedRequest[] = [];
  private tokens = new Map<string, UserKey>();
  private counter = 0;
  /** Simulated httpOnly refresh cookie (the identity it belongs to). */
  refreshCookie: UserKey | null = null;
  refreshFails = false;
  /** Artificial latency per path prefix (ms), to observe loading states. */
  latency = new Map<string, number>();
  private failures: { pattern: RegExp; status: number; code: string }[] = [];
  private overrides: { method: string; pattern: RegExp; handler: Handler }[] = [];
  auctions = auctionsSeed();
  bids = bidsSeed();
  documents = documentsSeed();
  dashboard: Record<UserKey, ReturnType<typeof dashboardFor>> = { A: dashboardFor('A'), B: dashboardFor('B') };

  /** Every request whose path matches answers with this status until cleared. */
  fail(pattern: RegExp, status: number, code = 'MOCK_FAILURE') {
    this.failures.push({ pattern, status, code });
  }
  clearFailures() {
    this.failures = [];
  }
  on(method: string, pattern: RegExp, handler: Handler) {
    this.overrides.unshift({ method, pattern, handler });
  }
  /** Invalidate every issued access token (as if they all expired). */
  expireAccessTokens() {
    this.tokens.clear();
  }
  requestsBy(identity: UserKey | null) {
    return this.requests.filter((request) => request.identity === identity);
  }

  private issue(key: UserKey) {
    this.counter += 1;
    const token = `mock-${key}-${this.counter}`;
    this.tokens.set(token, key);
    return token;
  }

  async install(page: Page) {
    await page.route(`${API}/**`, (route) => this.handle(route));
  }

  private async handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    const cors = {
      'Access-Control-Allow-Origin': ORIGIN,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
      'Access-Control-Expose-Headers': 'Content-Disposition, X-Content-SHA256, X-Report-Total, X-Report-Rows, X-Report-Truncated',
    };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });

    const authorization = request.headers().authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    const identity = token ? (this.tokens.get(token) ?? null) : null;
    this.requests.push({ method, path, identity });
    const delay = [...this.latency.entries()].find(([prefix]) => path.startsWith(prefix))?.[1];
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));

    const json = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
      route.fulfill({
        status,
        headers: { ...cors, ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    let body: unknown;
    try {
      body = request.postDataJSON();
    } catch {
      body = undefined;
    }

    // Authentication endpoints.
    if (path === '/auth/login' && method === 'POST') {
      const { email, password } = (body ?? {}) as { email?: string; password?: string };
      const key = (Object.keys(identities) as UserKey[]).find(
        (candidate) => identities[candidate].email === email && identities[candidate].password === password,
      );
      if (!key) return json(401, { code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' });
      this.refreshCookie = key;
      return json(200, { accessToken: this.issue(key), user: identities[key].user });
    }
    if (path === '/auth/refresh' && method === 'POST') {
      if (this.refreshFails || !this.refreshCookie) {
        this.refreshCookie = null;
        return json(401, { code: 'INVALID_REFRESH_TOKEN', message: 'La sesión no es válida o expiró.' });
      }
      return json(200, { accessToken: this.issue(this.refreshCookie), user: identities[this.refreshCookie].user });
    }
    if (path === '/auth/logout' && method === 'POST') {
      this.refreshCookie = null;
      return json(204);
    }
    if (path.startsWith('/auth/invitations')) return json(404, { code: 'INVITATION_NOT_FOUND', message: 'La invitación no existe o expiró.' });

    if (!identity) {
      return json(401, { code: token ? 'TOKEN_EXPIRED' : 'AUTHENTICATION_REQUIRED', message: 'La sesión expiró.' });
    }
    const failure = this.failures.find((item) => item.pattern.test(path));
    if (failure) {
      return json(failure.status, {
        code: failure.code,
        message: failure.status === 403 ? 'No tiene permisos para esta operación.' : 'Ocurrió un error interno.',
        correlationId: '00000000-mock-4000-8000-000000000000',
      });
    }
    const override = this.overrides.find((item) => item.method === method && item.pattern.test(path));
    if (override) return override.handler(route, { body, identity, url });

    const user = identities[identity].user;
    const page = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 20);
    const list = <T>(items: T[]) =>
      json(200, {
        data: items.slice((page - 1) * pageSize, page * pageSize),
        pagination: { page, pageSize, total: items.length, totalPages: Math.max(1, Math.ceil(items.length / pageSize)) },
      });
    const scoped = <T extends { organizationId?: string }>(items: T[]) =>
      user.permissions.includes('audit.read') ? items : items.filter((item) => item.organizationId === user.organizationId);

    if (path === '/auth/me') return json(200, { user });
    if (path === '/notifications/unread-count') return json(200, { data: { unread: identity === 'A' ? 3 : 1 } });
    if (path === '/analytics/dashboard') return json(200, { data: this.dashboard[identity] });

    if (path === '/auctions' && method === 'GET') {
      const status = url.searchParams.get('status');
      const q = url.searchParams.get('q')?.toLowerCase();
      return list(
        this.auctions.filter(
          (auction) =>
            (!status || auction.status === status) &&
            (!q || `${auction.code} ${auction.title}`.toLowerCase().includes(q)),
        ),
      );
    }
    const auctionMatch = /^\/auctions\/([^/]+)(\/status)?$/.exec(path);
    if (auctionMatch) {
      const auction = this.auctions.find((item) => item.id === auctionMatch[1]);
      if (!auction) return json(404, { code: 'AUCTION_NOT_FOUND', message: 'La subasta no existe.' });
      if (auctionMatch[2] && method === 'PATCH') {
        const { status } = body as { status: string; reason?: string };
        auction.status = status;
        return json(200, { data: auction });
      }
      return json(200, { data: auction });
    }

    if (path === '/bids' && method === 'GET') {
      const status = url.searchParams.get('status');
      return list(scoped(this.bids).filter((bid) => !status || bid.status === status));
    }
    if (path === '/bids' && method === 'POST') {
      const input = body as Record<string, unknown>;
      const auction = this.auctions.find((item) => item.id === input.auctionId)!;
      const created = {
        ...bidsSeed()[0]!,
        id: `b1000000-0000-4000-8000-00000000010${this.bids.length}`,
        projectName: String(input.projectName),
        offeredPowerMw: String(input.offeredPowerMw),
        status: 'BORRADOR',
        auction: { id: auction.id, code: auction.code, title: auction.title, status: auction.status, closeAt: auction.closeAt },
      };
      this.bids.unshift(created);
      return json(201, { data: created });
    }
    const bidAction = /^\/bids\/([^/]+)\/(submit|withdraw)$/.exec(path);
    if (bidAction) {
      const bid = this.bids.find((item) => item.id === bidAction[1]);
      if (!bid) return json(404, { code: 'BID_NOT_FOUND', message: 'La oferta no existe.' });
      bid.status = bidAction[2] === 'submit' ? 'ENVIADA' : 'RETIRADA';
      return json(200, { data: bid });
    }

    if (path === '/documents' && method === 'GET') return list(scoped(this.documents));
    if (path === '/documents' && method === 'POST') {
      const input = body as Record<string, string>;
      const created = {
        ...documentsSeed()[0]!,
        id: `d1000000-0000-4000-8000-00000000010${this.documents.length}`,
        title: input.title ?? 'Documento',
        documentType: input.documentType ?? 'OTRO',
        entityType: input.entityType ?? 'BID',
        currentVersionNumber: 1,
        versions: [{ ...documentsSeed()[0]!.versions[1]!, originalFileName: input.fileName ?? 'archivo' }],
      };
      this.documents.unshift(created);
      return json(201, { data: created });
    }
    const versionMatch = /^\/documents\/([^/]+)\/versions$/.exec(path);
    if (versionMatch && method === 'POST') {
      const document = this.documents.find((item) => item.id === versionMatch[1]);
      if (!document) return json(404, { code: 'DOCUMENT_NOT_FOUND', message: 'El documento no existe.' });
      document.currentVersionNumber += 1;
      return json(201, { data: document });
    }
    const downloadMatch = /^\/documents\/([^/]+)\/download$/.exec(path);
    if (downloadMatch) {
      const document = this.documents.find((item) => item.id === downloadMatch[1]);
      const name = document?.versions[0]?.originalFileName ?? 'documento.pdf';
      return route.fulfill({
        status: 200,
        headers: {
          ...cors,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="documento.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
        },
        body: '%PDF-1.7\n%%EOF',
      });
    }

    if (path === '/projects') {
      return list(
        scoped([
          { id: 'p1000000-0000-4000-8000-000000000001', organizationId: ORG_SOLAR, name: 'Parque solar Baní II', province: 'Peravia', renewableTechnologyCode: 'SOLAR' },
        ]),
      );
    }
    if (path === '/catalogs') {
      const type = url.searchParams.get('type');
      return json(200, {
        data:
          type === 'CURRENCY'
            ? [{ id: 'cur-usd', code: 'USD', name: 'Dólar estadounidense' }, { id: 'cur-dop', code: 'DOP', name: 'Peso dominicano' }]
            : [{ id: 'tech-solar', code: 'SOLAR', name: 'Solar fotovoltaica' }, { id: 'tech-wind', code: 'WIND', name: 'Eólica' }],
        pagination: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
      });
    }
    // Any other list endpoint: an empty, well-formed page.
    return list([]);
  }
}

export const loginAs = async (page: Page, key: UserKey) => {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(identities[key].email);
  await page.getByLabel('Contraseña', { exact: true }).fill(identities[key].password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
};
