# EcoSoft Enterprise — Programa de productización

Este directorio documenta la evolución posterior al MVP académico de EcoSoft. El repositorio conserva su origen como proyecto grupal de UNAPEC y, al mismo tiempo, establece una ruta técnica verificable hacia una edición Enterprise.

## Principios

1. El historial académico, autoría y licencia del código existente no se reescriben.
2. La edición Enterprise se define como una evolución de producto, no como una afirmación de propiedad exclusiva sobre el trabajo grupal original.
3. Ninguna integración externa se declara operativa sin credenciales, infraestructura y pruebas reales.
4. Las decisiones regulatorias y adjudicaciones continúan siendo humanas; IA/OCR permanece en función consultiva.
5. El aislamiento organizacional, la trazabilidad, la seguridad y la recuperación operativa son requisitos de producto.

## Fases 11–18

| Fase | Nombre                | Entregable verificable                                                               | Estado en esta edición   |
| ---: | --------------------- | ------------------------------------------------------------------------------------ | ------------------------ |
|   11 | Productization        | límites Academic/Enterprise, posicionamiento, modelo de despliegue y ownership       | ✅ Implementada          |
|   12 | Production Security   | baseline de seguridad productiva, configuración y checklist de hardening             | ✅ Implementada          |
|   13 | Enterprise Identity   | políticas MFA/SSO, configuración OIDC/SAML y contrato de adaptadores                 | ✅ Foundation completada |
|   14 | Multi-Organization    | modelo de tenancy sobre el aislamiento organizacional existente y reglas de contexto | ✅ Foundation completada |
|   15 | Cloud & Observability | topología Azure, ambientes, SLO/telemetría y runbooks                                | ✅ Foundation completada |
|   16 | Integrations          | contratos para correo, webhooks, almacenamiento y firma electrónica/digital          | ✅ Foundation completada |
|   17 | Compliance & Scale    | controles, pruebas de carga, retención, DR, RTO/RPO y evidencias                     | ✅ Foundation completada |
|   18 | Commercial Pilot      | onboarding, criterios de aceptación, soporte, métricas y go/no-go                    | ✅ Implementada          |

`Foundation completada` significa que el alcance definido para esta edición de portafolio está cerrado: código, contratos, configuración y documentación necesarios para conectar infraestructura o proveedores reales están preparados y verificables. No significa que dichos proveedores estén contratados, desplegados o certificados en producción.

Por tanto, las Fases 13–17 **no representan trabajo académico pendiente**. Su siguiente nivel corresponde a una futura reactivación comercial con infraestructura, credenciales, clientes y evidencia operativa reales.

## Definición de Enterprise v1.0

EcoSoft Enterprise v1.0 podrá declararse **Production Ready** únicamente cuando exista evidencia de:

- despliegue real en staging y producción;
- secretos en un gestor administrado;
- TLS y política CSP validados en el borde;
- backups automáticos y restauración ensayada;
- proveedor de identidad empresarial configurado y probado cuando el cliente lo requiera;
- análisis antimalware/CDR para documentos;
- monitoreo, alertas y SLO activos;
- revisión de privacidad, retención y cumplimiento aplicable;
- pruebas de carga con objetivos acordados;
- piloto con criterios de aceptación firmados.

Hasta entonces, la clasificación correcta es **Enterprise MVP / Pilot Ready**.
