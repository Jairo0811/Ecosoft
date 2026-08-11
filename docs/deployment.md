# Despliegue

## Desarrollo

Docker Compose inicia SQL Server 2022. La API y la web se ejecutan con hot reload mediante npm.

## Objetivo Azure

- Frontend estático en Azure Static Web Apps o App Service.
- API en Azure App Service/Container Apps.
- Azure SQL Database.
- Azure Blob Storage privado para documentos.
- Azure Key Vault para secretos.
- Application Insights y Log Analytics para observabilidad.

No existe despliegue automático a producción en esta fase. GitHub Actions valida cada PR. Los
entornos y aprobaciones manuales se diseñarán en Fase 10.
