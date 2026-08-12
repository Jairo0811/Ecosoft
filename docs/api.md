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

| Método | Ruta                        | Acceso                  |
| ------ | --------------------------- | ----------------------- |
| GET    | `/organizations`            | `organizations.read`    |
| GET    | `/organizations/:id`        | `organizations.read`    |
| POST   | `/organizations`            | `organizations.manage`  |
| PATCH  | `/organizations/:id`        | `organizations.manage`  |
| PATCH  | `/organizations/:id/status` | `organizations.approve` |
| GET    | `/catalogs`                 | `catalogs.read`         |
| POST   | `/catalogs`                 | `catalogs.manage`       |
| PATCH  | `/catalogs/:id`             | `catalogs.manage`       |
| PATCH  | `/catalogs/:id/status`      | `catalogs.manage`       |

Las organizaciones se filtran por texto, tipo y estado. Las decisiones de aprobación, rechazo y
suspensión exigen permisos separados y generan eventos de auditoría. Los catálogos usan códigos
únicos por tipo y se desactivan sin eliminación física.

Los contratos de Auctions, Bids, Evaluations, Awards y PPAContracts se agregarán con su fase. El
versionado evita romper clientes cuando el producto evolucione.
