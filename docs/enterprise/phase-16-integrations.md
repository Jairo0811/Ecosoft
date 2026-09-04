# Fase 16 — Integrations

## Objetivo

Preparar EcoSoft para integraciones productivas sin introducir dependencias directas del dominio con proveedores concretos.

## Integraciones prioritarias

### Correo transaccional

Casos: invitación, activación, alertas regulatorias, vencimientos y notificaciones críticas. El adaptador debe recibir plantillas y datos ya autorizados, aplicar idempotencia y registrar resultado sin persistir secretos.

### Webhooks salientes

- eventos permitidos por allowlist;
- endpoint HTTPS;
- secreto por suscripción almacenado fuera del código;
- firma HMAC del payload;
- timestamp y protección contra replay;
- reintentos con backoff;
- dead-letter/reprocesamiento controlado;
- auditoría de entrega.

### Almacenamiento documental

El puerto actual de almacenamiento debe admitir Blob privado, URLs temporales y estados `QUARANTINED`, `SAFE` o `REJECTED` cuando exista servicio antimalware/CDR.

### Firma electrónica/digital

EcoSoft no debe fabricar firmas legales. Se integra con un proveedor autorizado mediante un adaptador que conserva identificador de transacción, firmantes, hash del documento, timestamps, estado y evidencia devuelta por el proveedor.

### Identidad

OIDC es la opción preferida. SAML se mantiene como compatibilidad empresarial. La autenticación federada nunca sustituye el RBAC y scope interno.

## Contrato de integración

Todo adaptador productivo debe implementar:

1. timeout explícito;
2. retries únicamente en operaciones idempotentes;
3. correlation ID;
4. métricas de éxito/error/latencia;
5. redacción de secretos;
6. circuit-break/degradación cuando corresponda;
7. documentación de datos enviados al tercero;
8. pruebas contractuales con sandbox o mock verificable.

## Criterios de aceptación de foundation

- [x] Puertos y reglas de integración definidos.
- [x] Seguridad de webhooks especificada.
- [x] Evidencia de firma separada de la lógica PPA.
- [x] Política de datos de terceros definida.
- [ ] proveedor de correo contratado y probado;
- [ ] proveedor de firma seleccionado y probado;
- [ ] webhook probado contra consumidor externo real.
