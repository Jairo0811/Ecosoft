# Fase 12 — Production Security

## Objetivo

Convertir los controles de seguridad del MVP en un baseline explícito para despliegues productivos y evitar que configuración de desarrollo llegue accidentalmente a producción.

## Baseline obligatorio

### Borde y transporte
- TLS 1.2+ terminado en servicio administrado o reverse proxy controlado.
- HSTS habilitado únicamente en producción después de validar HTTPS.
- CSP explícita y revisada por ambiente.
- CORS limitado a orígenes de la instalación.
- `trust proxy` parametrizado según la topología real.

### Secretos y llaves
- Azure Key Vault o gestor equivalente.
- Rotación documentada para JWT, credenciales SQL, storage y proveedores.
- Identidades administradas cuando la plataforma lo permita.
- Ningún secreto real en repositorio, imagen o log.

### Documentos
- Blob/almacenamiento privado.
- URLs de acceso de corta duración cuando sean necesarias.
- análisis antimalware y, para instalaciones de alto riesgo, CDR antes de marcar un archivo como utilizable.
- cuarentena y auditoría del resultado de escaneo.

### Aplicación
- RBAC y alcance organizacional siempre en backend.
- rate limiting específico para autenticación y operaciones sensibles.
- validación Zod y límites de payload.
- mensajes de error sin stack trace en producción.
- Swagger deshabilitable en instalaciones que no autoricen documentación pública.

### Datos y recuperación
- cifrado en tránsito y en reposo administrado por infraestructura.
- backup automático de SQL y almacenamiento documental.
- restauración ensayada y registrada.
- política de retención aprobada por el cliente.

## Variables Enterprise

La configuración productiva incorpora banderas para documentación API, HSTS, CSP, MFA/SSO, tenancy y telemetría. La aplicación debe fallar de forma temprana cuando se active una capacidad que carezca de la configuración mínima requerida.

## Evidencia requerida antes de Production Ready

- [ ] escaneo SAST/dependencias sin hallazgos críticos abiertos;
- [ ] DAST contra staging;
- [ ] restauración completa ensayada;
- [ ] rotación de secretos ensayada;
- [ ] antimalware/CDR integrado;
- [ ] revisión de CSP, CORS y cookies;
- [ ] revisión formal de privacidad y retención;
- [ ] plan de respuesta a incidentes aprobado.
