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
- Alcance por organización y allowlist de roles para administradores empresariales.

## Modelo de amenazas resumido

| Riesgo                       | Control principal                                           |
| ---------------------------- | ----------------------------------------------------------- |
| robo de refresh token        | rotación, hash, expiración y revocación                     |
| escalamiento de privilegios  | permiso backend por ruta y pruebas negativas                |
| IDOR                         | consultas limitadas por organización y permiso              |
| inyección SQL                | Prisma, DTOs validados y prohibición de SQL generado por IA |
| documento malicioso          | allowlist MIME, límite 5 MB y almacenamiento privado        |
| filtración de ofertas        | ámbito organizacional y ocultamiento financiero por rol     |
| fuerza bruta                 | rate limiting y bloqueo temporal por intentos fallidos      |
| alteración de trazabilidad   | triggers inmutables y hash SHA-256 de cada evento nuevo     |
| secretos dentro de auditoría | redacción recursiva antes de persistir                      |
| IDOR en notificaciones       | `userId` derivado de la sesión en lectura y actualización   |
| normativa no autorizada      | autoridad aprobada, RBAC y transiciones justificadas        |

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

## Pendiente antes de producción

Azure Key Vault, gestión de llaves, TLS en el borde, análisis antivirus/CDR, política CSP afinada,
retención legal, restauración ensayada y revisión formal de privacidad. Estos controles dependen de
infraestructura y gobierno del entorno productivo.
