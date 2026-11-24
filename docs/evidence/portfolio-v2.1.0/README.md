# Evidencia visual — revisión de calidad v2.1.0

Capturas tomadas el 24 de noviembre de 2026 con Chromium (Playwright) sobre el bundle de
producción (`vite preview`):

- **before**: `main` en `fb4c2ce` (snapshot `archive/portfolio-v2.0.0`).
- **after**: rama `chore/final-portfolio-quality-pass`.

Ambas versiones usan el mismo doble determinista de la API (`apps/web/e2e/support/mock-api.ts`)
con la identidad de prueba "Ana Martínez, Administrador CNE". **Los datos son ficticios de prueba**,
no provienen de SQL Server ni de ninguna organización real. La autorización y los flujos con datos
reales se verifican en el job `sqlserver-integration` de la CI.

| Pantalla                  | Antes                                                         | Después                                                                  |
| ------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Login                     | ![](before-login-light-1440.webp)                             | ![](after-login-light-1440.webp)                                         |
| Panel de control          | ![](before-dashboard-light-1440.webp)                         | ![](after-dashboard-light-1440.webp) ![](after-dashboard-dark-1440.webp) |
| Panel en móvil (390 px)   | —                                                             | ![](after-dashboard-light-390.webp) ![](after-dashboard-dark-390.webp)   |
| Cancelación de subasta    | `window.prompt()` del navegador (no capturable)               | ![](after-subastas-cancelar-light-1440.webp)                             |
| Ofertas en móvil (oscuro) | —                                                             | ![](after-ofertas-dark-390.webp)                                         |
| Usuarios                  | ![](before-usuarios-light-1440.webp) suspensión sin confirmar | ![](after-usuarios-suspender-dark-1440.webp)                             |
| Asistencia documental     | ![](before-ia-light-1440.webp) UUID manual, JSON crudo        | ![](after-ia-light-1440.webp) ![](after-ia-dark-390.webp)                |

El `main` anterior arrancaba siempre en tema oscuro, sin considerar la preferencia del sistema
(se podía alternar manualmente); la versión nueva parte de la preferencia del sistema y también
permite alternarla.
