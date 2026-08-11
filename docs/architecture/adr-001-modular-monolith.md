# ADR-001: Monolito modular

- Estado: aceptado
- Fecha: 2026-08-10

## Decisión

Construir web, API y servicio futuro de IA en un monorepo. La API será un monolito modular con
límites explícitos por contexto.

## Consecuencia

Se reduce la carga de despliegue, transacciones distribuidas y observabilidad. Una futura extracción
exigirá contratos de eventos/API, pero los límites actuales preparan ese camino.
