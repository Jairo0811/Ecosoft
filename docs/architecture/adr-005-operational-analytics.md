# ADR-005: Analítica operacional sin almacén duplicado

- Estado: aceptada
- Fecha: 2026-08-12

## Contexto

La primera versión de analítica necesita indicadores actuales y reportes auditables, pero el
volumen académico inicial no justifica un data warehouse ni procesos ETL. Duplicar cifras podría
crear diferencias entre los reportes y el sistema de registro.

## Decisión

- Calcular KPIs y reportes desde SQL Server mediante consultas Prisma tipadas.
- Aplicar alcance por rol y organización antes de cada consulta.
- Mantener promedios y valores separados por moneda; no sumar monedas incompatibles.
- Generar CSV, Excel XML y PDF bajo demanda, sin persistir copias del reporte.
- Auditar toda exportación y enviar archivos con `Cache-Control: private, no-store`.
- Neutralizar celdas que puedan activar fórmulas en hojas de cálculo.

## Consecuencias

Existe una sola fuente de verdad y el MVP conserva menor complejidad operativa. Si el crecimiento
produce consultas costosas, se podrán introducir vistas materializadas, caché o un almacén
analítico conservando los mismos contratos API y las reglas de seguridad.
