# ADR-003: Documentos fuera de SQL Server

- Estado: aceptado
- Fecha: 2026-08-10

## Decisión

Guardar binarios en Azure Blob Storage privado y conservar en SQL Server metadata, versión, hash,
propietario y entidad asociada.

## Consecuencia

La base no crece por contenido binario y se aplican políticas de almacenamiento independientes. El
acceso siempre pasa por la API y URLs temporales tras autorización.
