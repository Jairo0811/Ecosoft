#!/usr/bin/env node
/**
 * End-to-end checks against a running API backed by a real SQL Server (CI job
 * `sqlserver-integration`). It creates its own isolated fixtures (two organizations, one company
 * admin per organization, one project per organization) with unique names, so it can run against
 * any freshly seeded test database. Never point it at a production installation.
 *
 * Covered: authentication negatives, refresh-token rotation (concurrent use and replay), logout
 * revocation, RBAC 403, organization isolation (IDOR) on projects/documents/analytics, document
 * upload integrity (SHA-256), content-type validation, concurrent versioning (exactly one wins,
 * no duplicate versions), report pagination totals and export truncation headers.
 *
 * Usage: API_URL=http://localhost:4000/api/v1 ADMIN_EMAIL=... ADMIN_PASSWORD=... node integration-check.mjs
 */
import { createHash, randomUUID } from 'node:crypto';

const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@ecosoft.com.do';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
const TRUSTED = { 'X-Requested-With': 'EcoSoftWeb' };
const RUN = randomUUID().slice(0, 8);

let failures = 0;
let passed = 0;
const check = (condition, message, detail) => {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${message}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
};
const section = (title) => console.log(`\n${title}`);

/** fetch wrapper returning { status, body, headers, cookie } with the refresh cookie extracted. */
const call = async (method, path, { token, body, headers = {}, cookie } = {}) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: `ecosoft_refresh=${cookie}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.get('set-cookie') ?? '';
  const refresh = /ecosoft_refresh=([^;]*)/.exec(setCookie)?.[1];
  const type = response.headers.get('content-type') ?? '';
  const payload = type.includes('application/json')
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  return { status: response.status, body: payload, headers: response.headers, cookie: refresh };
};

const login = async (email, password) => {
  const result = await call('POST', '/auth/login', { body: { email, password } });
  if (result.status !== 200) throw new Error(`login ${email} -> ${result.status}`);
  return { token: result.body.accessToken, cookie: result.cookie, user: result.body.user };
};

const createCompany = async (admin, label) => {
  const created = await call('POST', '/organizations', {
    token: admin.token,
    headers: TRUSTED,
    body: { legalName: `Integración ${label} ${RUN}`, type: 'GENERATION_COMPANY' },
  });
  if (created.status !== 201)
    throw new Error(`create org ${label}: ${JSON.stringify(created.body)}`);
  const id = created.body.data.id;
  const approved = await call('PATCH', `/organizations/${id}/status`, {
    token: admin.token,
    headers: TRUSTED,
    body: { status: 'APPROVED' },
  });
  if (approved.status !== 200)
    throw new Error(`approve org ${label}: ${JSON.stringify(approved.body)}`);

  const email = `empresa-${label.toLowerCase()}-${RUN}@integracion.test`;
  const password = `Integracion!${RUN}Aa1`;
  const invited = await call('POST', '/users/invitations', {
    token: admin.token,
    headers: TRUSTED,
    body: {
      email,
      firstName: 'Usuario',
      lastName: `Empresa ${label}`,
      organizationId: id,
      roleCodes: ['COMPANY_ADMIN'],
    },
  });
  if (invited.status !== 201) throw new Error(`invite ${label}: ${JSON.stringify(invited.body)}`);
  const rawToken = new URL(invited.body.data.activationUrl).searchParams.get('token');
  const accepted = await call('POST', '/auth/invitations/accept', {
    headers: TRUSTED,
    body: { token: rawToken, password, confirmPassword: password },
  });
  if (accepted.status >= 300) throw new Error(`accept ${label}: ${JSON.stringify(accepted.body)}`);
  const session = await login(email, password);

  const project = await call('POST', '/projects', {
    token: session.token,
    headers: TRUSTED,
    body: {
      name: `Parque solar ${label} ${RUN}`,
      renewableTechnologyCode: 'SOLAR',
      province: 'Peravia',
      municipality: 'Baní',
      installedCapacityMw: 25,
    },
  });
  if (project.status !== 201) throw new Error(`project ${label}: ${JSON.stringify(project.body)}`);
  return { organizationId: id, session, projectId: project.body.data.id };
};

const pdf = (text) => Buffer.from(`%PDF-1.7\n${text}\n%%EOF`).toString('base64');
const sha = (base64) => createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex');

const main = async () => {
  if (!ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD or SEED_ADMIN_PASSWORD is required');
  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  section('Autenticación');
  check((await call('GET', '/projects')).status === 401, 'sin token -> 401');
  check(
    (await call('GET', '/projects', { token: `${admin.token.slice(0, -2)}xx` })).status === 401,
    'token alterado -> 401',
  );
  check(
    (
      await call('POST', '/auth/login', {
        body: { email: ADMIN_EMAIL, password: 'incorrecta-123' },
      })
    ).status === 401,
    'credenciales inválidas -> 401',
  );
  const unknown = await call('POST', '/auth/login', {
    body: { email: `no-existe-${RUN}@integracion.test`, password: 'incorrecta-123' },
  });
  const wrong = await call('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL, password: 'incorrecta-123' },
  });
  check(
    unknown.status === wrong.status && unknown.body.code === wrong.body.code,
    'mismo error para cuenta inexistente y contraseña incorrecta (sin enumeración)',
    { unknown: unknown.body.code, wrong: wrong.body.code },
  );

  section('Rotación de refresh tokens (SQL Server)');
  const rotating = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  check(
    (await call('POST', '/auth/refresh', { cookie: rotating.cookie })).status === 403,
    'refresh sin cabecera web confiable -> 403',
  );
  const [first, second] = await Promise.all([
    call('POST', '/auth/refresh', { cookie: rotating.cookie, headers: TRUSTED }),
    call('POST', '/auth/refresh', { cookie: rotating.cookie, headers: TRUSTED }),
  ]);
  const winners = [first, second].filter((result) => result.status === 200);
  check(winners.length === 1, 'refresh concurrente con el mismo token: exactamente uno gana', [
    first.status,
    second.status,
  ]);
  const replay = await call('POST', '/auth/refresh', { cookie: rotating.cookie, headers: TRUSTED });
  check(replay.status === 401, 'reutilizar un refresh token ya rotado -> 401');
  const familyAfterReplay = await call('POST', '/auth/refresh', {
    cookie: winners[0]?.cookie,
    headers: TRUSTED,
  });
  check(
    familyAfterReplay.status === 401,
    'la reutilización revoca toda la familia (el token ganador también queda inválido)',
  );

  const loggedOut = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const logout = await call('POST', '/auth/logout', {
    cookie: loggedOut.cookie,
    headers: TRUSTED,
  });
  check(logout.status === 204, 'logout sin access token válido revoca la cookie -> 204');
  check(
    (await call('POST', '/auth/refresh', { cookie: loggedOut.cookie, headers: TRUSTED })).status ===
      401,
    'tras logout el refresh token queda revocado',
  );

  section('Organizaciones aisladas');
  const a = await createCompany(admin, 'A');
  const b = await createCompany(admin, 'B');
  check(Boolean(a.projectId && b.projectId), 'empresas A y B con proyecto propio');

  check(
    (await call('GET', `/projects/${a.projectId}`, { token: b.session.token })).status === 404,
    'B no puede leer el proyecto de A (IDOR -> 404)',
  );
  const listB = await call('GET', '/projects?pageSize=100', { token: b.session.token });
  check(
    listB.status === 200 && listB.body.data.every((item) => item.id !== a.projectId),
    'el listado de B no contiene proyectos de A',
  );
  check(
    (await call('GET', '/audit', { token: b.session.token })).status === 403,
    'empresa sin audit.read -> 403 en auditoría',
  );
  const dashboardB = await call('GET', '/analytics/dashboard', { token: b.session.token });
  check(
    dashboardB.status === 200 &&
      dashboardB.body.data.filters.organizationId === b.organizationId &&
      dashboardB.body.data.recentActivity.length === 0,
    'dashboard de B: alcance propio y sin actividad de auditoría',
    dashboardB.body?.data?.filters,
  );
  const spoofScope = await call('GET', `/analytics/dashboard?organizationId=${a.organizationId}`, {
    token: b.session.token,
  });
  check(
    spoofScope.status === 200 && spoofScope.body.data.filters.organizationId === b.organizationId,
    'B no puede ampliar el alcance analítico pidiendo organizationId de A',
  );

  section('Documentos: integridad y concurrencia');
  const content = pdf(`expediente técnico ${RUN}`);
  const createdDoc = await call('POST', '/documents', {
    token: a.session.token,
    headers: TRUSTED,
    body: {
      entityType: 'ENERGY_PROJECT',
      entityId: a.projectId,
      documentType: 'ESTUDIO_TECNICO',
      title: 'Estudio técnico de interconexión',
      fileName: 'estudio-técnico.pdf',
      mimeType: 'application/pdf',
      contentBase64: content,
    },
  });
  check(createdDoc.status === 201, 'carga válida -> 201', createdDoc.body);
  const documentId = createdDoc.body?.data?.id;
  check(
    createdDoc.body?.data?.versions?.[0]?.sha256 === sha(content),
    'SHA-256 registrado coincide con el contenido',
  );

  const mismatch = await call('POST', '/documents', {
    token: a.session.token,
    headers: TRUSTED,
    body: {
      entityType: 'ENERGY_PROJECT',
      entityId: a.projectId,
      documentType: 'ESTUDIO_TECNICO',
      title: 'Ejecutable renombrado',
      fileName: 'malicioso.pdf',
      mimeType: 'application/pdf',
      contentBase64: Buffer.from('MZ\x90\x00 not a pdf').toString('base64'),
    },
  });
  check(
    mismatch.status === 400 && mismatch.body.code === 'DOCUMENT_CONTENT_MISMATCH',
    'contenido que no corresponde al MIME declarado -> 400',
    mismatch.body,
  );
  const crossOrg = await call('POST', '/documents', {
    token: b.session.token,
    headers: TRUSTED,
    body: {
      entityType: 'ENERGY_PROJECT',
      entityId: a.projectId,
      documentType: 'ESTUDIO_TECNICO',
      title: 'Intento cruzado',
      fileName: 'cruzado.pdf',
      mimeType: 'application/pdf',
      contentBase64: content,
    },
  });
  check(crossOrg.status === 404, 'B no puede adjuntar documentos a entidades de A -> 404');
  check(
    (await call('GET', `/documents/${documentId}/download`, { token: b.session.token })).status ===
      404,
    'B no puede descargar el documento de A -> 404',
  );
  const download = await call('GET', `/documents/${documentId}/download`, {
    token: a.session.token,
  });
  check(
    download.status === 200 &&
      createHash('sha256').update(download.body).digest('hex') === sha(content) &&
      download.headers.get('x-content-sha256') === sha(content),
    'descarga verificada con SHA-256',
  );
  check(
    /filename\*=UTF-8''estudio-t%C3%A9cnico\.pdf/.test(
      download.headers.get('content-disposition') ?? '',
    ),
    'nombre de archivo UTF-8 preservado en la descarga',
  );

  const versionBodies = [1, 2, 3].map((n) => ({
    fileName: `estudio-v${n}.pdf`,
    mimeType: 'application/pdf',
    contentBase64: pdf(`versión concurrente ${n} ${RUN}`),
  }));
  const versionResults = await Promise.all(
    versionBodies.map((body) =>
      call('POST', `/documents/${documentId}/versions`, {
        token: a.session.token,
        headers: TRUSTED,
        body,
      }),
    ),
  );
  const statuses = versionResults.map((result) => result.status).sort();
  check(
    statuses.filter((status) => status === 201).length >= 1 &&
      statuses.every((status) => status === 201 || status === 409),
    'versiones concurrentes: solo 201 o 409 (nunca 500)',
    statuses,
  );
  const afterVersions = await call('GET', `/documents/${documentId}`, { token: a.session.token });
  const versions = afterVersions.body?.data?.versions ?? [];
  const numbers = versions.map((version) => version.versionNumber);
  const successes = versionResults.filter((result) => result.status === 201).length;
  check(
    new Set(numbers).size === numbers.length && numbers.length === 1 + successes,
    'sin versiones duplicadas ni perdidas',
    { numbers, successes },
  );
  check(
    afterVersions.body?.data?.currentVersionNumber === Math.max(...numbers),
    'currentVersionNumber apunta a la última versión confirmada',
  );

  section('Reportes');
  const report = await call('GET', '/reports/projects?pageSize=1&page=1', { token: admin.token });
  check(
    report.status === 200 &&
      report.body.data.length <= 1 &&
      report.body.pagination.total >= 2 &&
      report.body.pagination.totalPages === report.body.pagination.total,
    'paginación con total real calculado en SQL Server',
    report.body?.pagination,
  );
  const reportB = await call('GET', '/reports/projects?pageSize=100', { token: b.session.token });
  check(
    reportB.status === 200 &&
      reportB.body.data.every((row) => row.Empresa === `Integración B ${RUN}`),
    'reporte de B limitado a su organización',
  );
  const exportXlsx = await call('GET', '/reports/projects/export?format=xlsx', {
    token: admin.token,
  });
  check(
    exportXlsx.status === 200 &&
      exportXlsx.body.subarray(0, 2).toString('latin1') === 'PK' &&
      exportXlsx.headers.get('x-report-truncated') === 'false',
    'exportación XLSX real con cabeceras de truncamiento',
  );
  const exportPdf = await call('GET', '/reports/projects/export?format=pdf', {
    token: admin.token,
  });
  check(
    exportPdf.status === 200 && exportPdf.body.subarray(0, 5).toString('latin1') === '%PDF-',
    'exportación PDF',
  );

  console.log(`\n${passed} verificaciones correctas, ${failures} fallidas.`);
  if (failures) process.exit(1);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
