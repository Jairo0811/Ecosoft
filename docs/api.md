# Contrato API

Base URL: `/api/v1`. La documentación navegable se sirve en `/api/docs`.

## Convenciones

- JSON UTF-8 y nombres `camelCase`.
- `Authorization: Bearer <access-token>` para recursos protegidos.
- `X-Correlation-Id` aceptado y devuelto por la API.
- errores con `{ code, message, correlationId, details? }`.
- paginación futura: `page`, `pageSize`, `sort`, `order`, `search`.

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

Los contratos de Auctions, Bids, Evaluations, Awards y PPAContracts se agregarán con su fase. El
versionado evita romper clientes cuando el producto evolucione.
