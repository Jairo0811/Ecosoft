# Contrato API

Base URL: `/api/v1`. La documentación navegable se sirve en `/api/docs`.

## Convenciones

- JSON UTF-8 y nombres `camelCase`.
- `Authorization: Bearer <access-token>` para recursos protegidos.
- `X-Correlation-Id` aceptado y devuelto por la API.
- errores con `{ code, message, correlationId, details? }`.
- paginación: `page` y `pageSize`; filtros específicos por recurso.

## Fase 1

| Método | Ruta             | Acceso               |
| ------ | ---------------- | -------------------- |
| GET    | `/health/live`   | público              |
| GET    | `/health/ready`  | público              |
| POST   | `/auth/login`    | público limitado     |
| POST   | `/auth/refresh`  | público limitado     |
| POST   | `/auth/logout`   | autenticado          |
| GET    | `/auth/me`       | autenticado          |
| GET    | `/users`         | `users.manage`       |
| GET    | `/roles`         | `users.manage`       |
| GET    | `/organizations` | `organizations.read` |
| GET    | `/audit`         | `audit.read`         |

## Fase 2

| Método | Ruta                            | Acceso                  |
| ------ | ------------------------------- | ----------------------- |
| GET    | `/organizations`                | `organizations.read`    |
| GET    | `/organizations/:id`            | `organizations.read`    |
| POST   | `/organizations`                | `organizations.manage`  |
| PATCH  | `/organizations/:id`            | `organizations.manage`  |
| PATCH  | `/organizations/:id/status`     | `organizations.approve` |
| GET    | `/catalogs`                     | `catalogs.read`         |
| POST   | `/catalogs`                     | `catalogs.manage`       |
| PATCH  | `/catalogs/:id`                 | `catalogs.manage`       |
| PATCH  | `/catalogs/:id/status`          | `catalogs.manage`       |
| GET    | `/users`                        | `users.manage`          |
| GET    | `/users/invitations`            | `users.manage`          |
| POST   | `/users/invitations`            | `users.manage`          |
| PATCH  | `/users/invitations/:id/revoke` | `users.manage`          |
| PATCH  | `/users/:id/status`             | `users.manage`          |
| PUT    | `/users/:id/roles`              | `users.manage`          |
| PATCH  | `/users/:id/unlock`             | `users.manage`          |
| POST   | `/auth/invitations/validate`    | público limitado        |
| POST   | `/auth/invitations/accept`      | público limitado        |

Las organizaciones se filtran por texto, tipo y estado. Las decisiones de aprobación, rechazo y
suspensión exigen permisos separados y generan eventos de auditoría. Los catálogos usan códigos
únicos por tipo y se desactivan sin eliminación física.

Las invitaciones almacenan únicamente el hash SHA-256 del token, vencen según
`INVITATION_TTL_HOURS` y se consumen una sola vez. La contraseña de activación exige 12 caracteres,
mayúscula, minúscula, número y símbolo. Los cambios de estado o roles revocan de inmediato todas
las sesiones del usuario. CNE administra roles institucionales y empresariales; los administradores
de empresa quedan limitados a su propia organización y a roles empresariales.

## Fase 3

| Método | Ruta                         | Acceso                    |
| ------ | ---------------------------- | ------------------------- |
| GET    | `/auctions`                  | `auctions.read` + alcance |
| GET    | `/auctions/:id`              | `auctions.read` + alcance |
| POST   | `/auctions`                  | `auctions.create`         |
| PATCH  | `/auctions/:id`              | `auctions.update`         |
| PUT    | `/auctions/:id/requirements` | `auctions.update`         |
| PUT    | `/auctions/:id/participants` | `auctions.update`         |
| PATCH  | `/auctions/:id/status`       | `auctions.publish`        |
| GET    | `/auctions/:id/events`       | `auctions.read` + alcance |
| GET    | `/calendar`                  | `auctions.read` + alcance |
| POST   | `/calendar`                  | `auctions.update`         |
| DELETE | `/calendar/:id`              | `auctions.update`         |

Los borradores son visibles únicamente para roles institucionales. Las empresas acceden a procesos
publicados donde su organización figure como participante habilitado. Las transiciones de estado,
cambios de requisitos/participantes y eventos manuales generan auditoría; el historial propio de
la subasta es de solo anexado desde la aplicación.

## Fases 4 a 6

| Recurso                   | Operaciones principales                         | Permiso base              |
| ------------------------- | ----------------------------------------------- | ------------------------- |
| `/bids`                   | listar, crear y actualizar borrador             | `bids.read/submit`        |
| `/bids/:id/submit`        | validar expediente, sellar hash y enviar        | `bids.submit`             |
| `/documents`              | listar y cargar documento privado               | `documents.read/manage`   |
| `/documents/:id/versions` | agregar una versión inmutable                   | `documents.manage`        |
| `/evaluations/matrices`   | configurar y publicar criterios ponderados      | `evaluations.manage`      |
| `/evaluations`            | listar y enviar evaluación técnica o financiera | `evaluations.read/submit` |
| `/evaluations/awards`     | crear y aprobar una adjudicación                | `awards.manage/approve`   |
| `/projects`               | registrar y transicionar proyectos              | `projects.read/manage`    |
| `/contracts`              | crear, versionar y transicionar PPA             | `contracts.read/create`   |

El backend fuerza el ámbito organizacional. Las versiones de ofertas, documentos y contratos, y
los historiales de proyectos/PPA, son de solo anexado y están protegidos por triggers SQL Server.

## Fase 7

| Método | Ruta                    | Acceso                     |
| ------ | ----------------------- | -------------------------- |
| GET    | `/analytics/dashboard`  | `analytics.read` + alcance |
| GET    | `/reports/:type`        | `reports.read` + alcance   |
| GET    | `/reports/:type/export` | `reports.export` + alcance |

`analytics/dashboard` acepta `from`, `to`, `organizationId` y `technology`. Los reportes agregan
`status`, `page` y `pageSize`. Los tipos disponibles son `auctions`, `participants`, `bids`,
`awards`, `contracts`, `projects`, `capacity` y `audit`; este último exige además `audit.read`.

Las exportaciones admiten `csv`, `xls` y `pdf`, usan `Cache-Control: private, no-store` y registran
usuario, organización, formato, cantidad de filas y `CorrelationId` en auditoría. Un usuario
empresarial no puede ampliar su alcance mediante `organizationId`; el backend fuerza siempre su
organización autenticada.

## Fase 8

| Método | Ruta                          | Acceso               |
| ------ | ----------------------------- | -------------------- |
| GET    | `/audit`                      | `audit.read`         |
| GET    | `/audit/:id`                  | `audit.read`         |
| GET    | `/regulatory`                 | `regulatory.read`    |
| GET    | `/regulatory/:id`             | `regulatory.read`    |
| POST   | `/regulatory`                 | `regulatory.manage`  |
| PUT    | `/regulatory/:id`             | `regulatory.manage`  |
| PATCH  | `/regulatory/:id/status`      | `regulatory.manage`  |
| GET    | `/notifications`              | `notifications.read` |
| GET    | `/notifications/unread-count` | `notifications.read` |
| PATCH  | `/notifications/:id/read`     | `notifications.read` |
| POST   | `/notifications/read-all`     | `notifications.read` |

La consulta de auditoría acepta acción, módulo, resultado, usuario, organización, rango UTC,
búsqueda y paginación. Leer evidencia genera a su vez un evento `READ_SENSITIVE`. No existen rutas
de modificación o eliminación para `AuditLog` ni `RegulationEvent`.

Las regulaciones nacen en `BORRADOR`. Solo los borradores son editables; publicación, suspensión,
reactivación y derogación se registran como transiciones justificadas. Los usuarios sin
`regulatory.manage` solo ven elementos `VIGENTE`. Los alcances `AUCTION`, `PPA_CONTRACT` y
`ENERGY_PROJECT` se validan contra la base; `EVALUATION` queda preparado para la integración de la
Fase 5 y no introduce reglas regulatorias reales.

Las notificaciones se deduplican por usuario y clave de origen. El backend fuerza `userId` desde
la sesión para evitar IDOR y genera alertas de cierres en siete días y contratos próximos a vencer
en noventa días. Los adaptadores de correo y tiempo real son puertos sin proveedor configurado.

## Fase 9

| Método | Ruta             | Acceso      | Resultado                            |
| ------ | ---------------- | ----------- | ------------------------------------ |
| GET    | `/ai`            | `ai.use`    | análisis visibles por organización   |
| POST   | `/ai/ocr`        | `ai.use`    | texto, fuente, proveedor y confianza |
| POST   | `/ai/analyze`    | `ai.use`    | resumen o señales de anomalía        |
| PATCH  | `/ai/:id/review` | `ai.review` | revisión humana con notas            |

La API no expone una ruta que permita a la IA adjudicar, aprobar o ejecutar cambios de dominio.
