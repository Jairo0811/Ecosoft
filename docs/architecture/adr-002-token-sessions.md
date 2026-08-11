# ADR-002: Sesiones con refresh token rotativo

- Estado: aceptado
- Fecha: 2026-08-10

## Decisión

Usar access tokens cortos y refresh tokens rotativos. Persistir solo SHA-256 del refresh token, con
familia, expiración y revocación. Los permisos viajan en el access token y siguen siendo validados
por middleware backend.

## Consecuencia

La API permanece escalable sin perder revocación de sesiones. Cambios de permisos requieren renovar
el access token o revocar sesiones cuando el cambio sea crítico.
