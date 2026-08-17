# ADR-006: gobierno inmutable y entrega desacoplada de alertas

## Estado

Aceptado para la Fase 8.

## Contexto

EcoSoft necesita evidencia resistente a cambios, seguimiento regulatorio y avisos oportunos. No
existe todavía una decisión institucional sobre proveedor de correo ni infraestructura Socket.IO.
Tampoco se han definido reglas regulatorias formales que puedan codificarse de manera irreversible.

## Decisión

- `AuditLog` y `RegulationEvent` serán de solo anexado en la aplicación y estarán protegidos por
  triggers SQL Server contra modificación o eliminación.
- Cada nuevo evento de auditoría incluirá un hash SHA-256 de su contenido canónico, después de
  redactar secretos.
- Las regulaciones conservarán datos oficiales y alcances configurables; no ejecutarán reglas de
  cumplimiento inventadas.
- Las notificaciones se deduplicarán por usuario y fuente, y siempre se consultarán dentro del
  usuario autenticado.
- Correo y tiempo real dependerán de puertos estables con adaptadores no operativos hasta elegir
  proveedores y políticas de entrega.

## Consecuencias

La trazabilidad queda protegida incluso ante errores futuros de la API. Se pueden recalcular
alertas sin duplicarlas. Incorporar correo o Socket.IO no exige modificar las reglas del dominio.
La retención legal, firma externa y replicación WORM siguen siendo decisiones de producción.
