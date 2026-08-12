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

Los contratos de Bids, Evaluations, Awards y PPAContracts se agregarán con su fase. El versionado
evita romper clientes cuando el producto evolucione.
