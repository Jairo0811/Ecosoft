# Fase 17 — Compliance & Scale

## Objetivo

Convertir calidad, recuperación y cumplimiento en evidencia repetible antes de comprometer un SLA o procesar información regulatoria real.

## Compliance by evidence

EcoSoft no se declara "certificado" por incluir controles técnicos. Cada instalación debe identificar normativa contractual, privacidad, archivo/retención, firma y residencia aplicable con el cliente y asesoría competente.

La plataforma debe producir evidencia de:

- control de acceso y revisiones periódicas;
- cambios de roles y revocaciones;
- auditoría inmutable;
- exportaciones sensibles;
- restauraciones ensayadas;
- despliegues y migraciones;
- incidentes y acciones correctivas;
- proveedores/subprocesadores utilizados.

## Retención

La retención no se hardcodea con plazos inventados. Debe ser una política por instalación/clase de dato aprobada por el cliente. Un hold legal debe poder impedir purgas automatizadas.

## Recuperación

Antes de Production Ready se definen y ensayan:

- RPO por base de datos y documentos;
- RTO del servicio;
- backup consistente de SQL + metadata/storage;
- restauración en ambiente aislado;
- rollback de despliegue;
- reconciliación posterior a incidente.

## Escala

Escenarios mínimos de carga:

1. autenticación concurrente;
2. lectura de dashboard/reportes;
3. carga y descarga de documentos;
4. ventana de cierre de subasta;
5. envío concurrente de ofertas;
6. exportaciones grandes;
7. jobs de alertas/vencimientos;
8. degradación del servicio IA/OCR.

Las pruebas deben medir p50/p95/p99, throughput, error rate, saturación SQL y memoria/CPU. Los objetivos se fijan con datos del piloto; no se inventa capacidad comercial.

## Gate de salida

- [ ] sin vulnerabilidades críticas conocidas abiertas;
- [ ] pruebas cross-organization/IDOR aprobadas;
- [ ] carga objetivo aprobada;
- [ ] restore drill aprobado;
- [ ] RTO/RPO registrados;
- [ ] privacidad/retención revisadas;
- [ ] inventario de subprocesadores;
- [ ] plan de incidentes ejercitado.

La fase queda implementada como marco técnico; el gate solo puede cerrarse con infraestructura y datos operativos reales.
