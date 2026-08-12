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

| Riesgo                      | Control principal                                               |
| --------------------------- | --------------------------------------------------------------- |
| robo de refresh token       | rotación, hash, expiración y revocación                         |
| escalamiento de privilegios | permiso backend por ruta y pruebas negativas                    |
| IDOR                        | consultas limitadas por organización y permiso                  |
| inyección SQL               | Prisma, DTOs validados y prohibición de SQL generado por IA     |
| documento malicioso         | allowlist, tamaño, inspección y almacenamiento privado (Fase 4) |
| filtración de ofertas       | reglas de visibilidad por estado y auditoría (Fase 4)           |
| fuerza bruta                | rate limiting y bloqueo temporal por intentos fallidos          |

## Pendiente antes de producción

Azure Key Vault, gestión de llaves, TLS en el borde, análisis antivirus, política CSP afinada,
pruebas IDOR completas, retención legal, respaldo/restauración y revisión formal de privacidad.
