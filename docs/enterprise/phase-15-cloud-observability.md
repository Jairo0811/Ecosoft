# Fase 15 — Cloud & Observability

## Objetivo

Definir una topología reproducible para staging/producción, telemetría operativa y criterios de salud que permitan operar EcoSoft como servicio Enterprise.

## Topología Azure de referencia

- Web: Azure Static Web Apps o App Service.
- API: Azure App Service o Container Apps.
- IA/OCR: Container Apps con acceso privado cuando sea posible.
- Datos: Azure SQL Database.
- Documentos: Azure Blob Storage privado.
- Secretos: Azure Key Vault.
- Observabilidad: Application Insights + Log Analytics.
- Borde: Front Door/Application Gateway según requisitos de WAF, red y residencia.

La arquitectura no depende funcionalmente de Azure: los puertos de storage, correo, IA/OCR e identidad deben poder tener adaptadores equivalentes.

## Ambientes

`development` → `test/CI` → `staging` → `production`.

Staging debe reproducir configuración de producción salvo tamaño/costo y utilizar secretos/datos separados.

## Telemetría mínima

- `correlationId` por request;
- installation/tenant key no sensible;
- latencia y tasa de errores HTTP;
- disponibilidad de SQL, storage e IA/OCR;
- duración y fallo de jobs;
- intentos de autenticación y bloqueos como métricas agregadas;
- eventos auditables separados de logs operativos;
- alertas sin incluir documentos, tokens, contraseñas ni payloads confidenciales.

## SLO iniciales para piloto

Los valores finales se pactan por cliente. Durante piloto se medirán disponibilidad, p95 de endpoints críticos, tasa de errores, tiempo de procesamiento de documentos y éxito de jobs. No se promete un SLA contractual antes de observar carga real.

## Runbooks requeridos

- pérdida de conectividad SQL;
- storage no disponible;
- degradación de proveedor IA/OCR;
- revocación de secretos;
- despliegue fallido y rollback;
- restauración de backup;
- incidente de seguridad.

## Criterios de aceptación de foundation

- [x] Topología objetivo documentada.
- [x] Separación de ambientes definida.
- [x] Esquema de telemetría y SLO definido.
- [x] Runbooks mínimos identificados.
- [ ] Recursos Azure provisionados.
- [ ] Alertas y dashboards validados con tráfico real.
