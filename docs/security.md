# Estrategia de seguridad

## Controles de identidad

- Access token JWT de corta duración y refresh token rotativo.
- Refresh tokens almacenados únicamente como SHA-256 y revocación por sesión/familia.
- Contraseñas con bcrypt y costo configurable; no se registran credenciales.
- RBAC y permisos granulares comprobados en backend.
- Helmet, CORS restrictivo, rate limiting, límites JSON y validación Zod.
- Correlation ID, logs estructurados y auditoría de acciones sensibles.
- mensajes de error controlados sin stack traces en producción.
- seed sin contraseña predeterminada: exige `SEED_ADMIN_PASSWORD`.
- Invitaciones de un solo uso: token aleatorio almacenado solo como hash, expiración y revocación.
- Contraseña de activación fuerte y enlace temporal sin credenciales predefinidas.
- `authVersion` comprobada en cada solicitud para invalidar access tokens tras suspensión o cambio
  de roles; los refresh tokens también se revocan.
- Alcance por organización y allowlist de roles para administradores empresariales; sin
  organización, el alcance falla cerrado (UUID nulo) y la analítica no devuelve datos globales.
- Rotación atómica del refresh token: una renovación concurrente recibe `REFRESH_CONFLICT` y la
  reutilización de un token rotado revoca la familia completa.
- El login dedica una comparación bcrypt a cada rechazo, de modo que el tiempo de respuesta no
  revela si la cuenta existe, está bloqueada o inactiva; el mensaje de error es uniforme.

## Red y despliegue local

- `TRUST_PROXY` (por defecto `false`) gobierna `trust proxy` de Express. Con `false`,
  `X-Forwarded-For` se ignora y la IP es la del socket, así que un cliente no puede falsificarla
  para evadir el rate limiting ni para alterar la IP auditada. Detrás de un proxy propio se indica
  el número de saltos (`1`) o las subredes del proxy; `true` se rechaza al arrancar.
- Docker Compose publica SQL Server y FastAPI solo en `127.0.0.1`. FastAPI no tiene autenticación
  propia: es un servicio interno consumido por la API y no debe exponerse a otras redes.
- La configuración de Compose es para la edición local y no constituye una configuración segura de
  producción.

## Frontend

- El estado de sesión vive en `sessionStorage` y la caché de TanStack Query se purga al cambiar de
  identidad, cerrar sesión, expirar o ser revocada; respuestas tardías de una identidad anterior se
  descartan. Una prueba E2E inicia sesión con dos identidades en la misma pestaña y falla si la
  segunda llega a ver datos de la primera.
- Ocultar módulos y acciones según permisos es solo una mejora de experiencia: cada ruta también
  está protegida en el cliente y el backend sigue siendo la autoridad.

## Modelo de amenazas resumido

| Riesgo                       | Control principal                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| robo de refresh token        | rotación, hash, expiración y revocación                                                           |
| escalamiento de privilegios  | permiso backend por ruta y pruebas negativas                                                      |
| IDOR                         | consultas limitadas por organización y permiso                                                    |
| inyección SQL                | Prisma, DTOs validados y prohibición de SQL generado por IA                                       |
| documento malicioso          | allowlist MIME, firma real del contenido, límite 5 MB y almacenamiento privado; sin antivirus/CDR |
| documento alterado en disco  | SHA-256 verificado en cada descarga (falla cerrada)                                               |
| suplantación de IP           | `TRUST_PROXY=false` por defecto                                                                   |
| filtración de ofertas        | ámbito organizacional y ocultamiento financiero por rol                                           |
| fuerza bruta                 | rate limiting y bloqueo temporal por intentos fallidos                                            |
| alteración de trazabilidad   | triggers inmutables y hash SHA-256 de cada evento nuevo                                           |
| secretos dentro de auditoría | redacción recursiva antes de persistir                                                            |
| IDOR en notificaciones       | `userId` derivado de la sesión en lectura y actualización                                         |
| normativa no autorizada      | autoridad aprobada, RBAC y transiciones justificadas                                              |

## Gobierno y evidencia

- `AuditLog` y `RegulationEvent` no tienen endpoints de edición ni eliminación.
- SQL Server rechaza físicamente `UPDATE` y `DELETE` sobre ambos historiales.
- Las lecturas de evidencia detallada se registran como `READ_SENSITIVE`.
- Los valores auditados se serializan de forma estable y ocultan contraseñas, tokens, secretos,
  cookies, cabeceras de autorización y hashes.
- Una regulación vigente deja de ser editable; cualquier cambio posterior se expresa mediante
  estado e historial.
- Los consumidores empresariales solo reciben alertas de sus participaciones y contratos.
- Versiones de ofertas, documentos y PPA e historiales de proyecto/contrato tienen triggers que
  rechazan modificación o eliminación.
- Resultados de IA conservan hash de entrada, proveedor, fuentes y revisión humana.

## Dependencias

`npm audit --omit=dev --audit-level=high` no reporta vulnerabilidades. Quedan advisories en
dependencias **solo de desarrollo** (vitest 3.2 → tinypool y `@vitest/mocker`; jest/glob/minimatch)
cuyo arreglo exige versiones mayores de vitest/jest. Vitest se ejecuta en jsdom, sin modo navegador
ni servidor UI expuesto, y no forma parte del artefacto desplegado; la actualización mayor queda
registrada como deuda técnica. Las dependencias Python se revisan con `pip-audit`.

## Pendiente antes de producción

Azure Key Vault, gestión de llaves, TLS en el borde, análisis antivirus/CDR, política CSP afinada,
retención legal, restauración ensayada y revisión formal de privacidad. Estos controles dependen de
infraestructura y gobierno del entorno productivo.
