# Despliegue

## Desarrollo

Docker Compose inicia SQL Server 2022 y FastAPI. La API y la web se ejecutan con hot reload
mediante npm. Los documentos se guardan fuera del repositorio en `DOCUMENT_STORAGE_PATH`.

## Objetivo Azure

- Frontend estático en Azure Static Web Apps o App Service.
- API en Azure App Service/Container Apps.
- Azure SQL Database.
- Azure Blob Storage privado para documentos.
- Azure Key Vault para secretos.
- Application Insights y Log Analytics para observabilidad.

## Promoción y recuperación

1. La CI valida formato, lint, tipos, pruebas, build, migraciones SQL Server, FastAPI y E2E.
2. La imagen o artefacto se promueve primero a staging con secretos del entorno.
3. Un responsable ejecuta smoke tests y aprueba manualmente producción.
4. Las migraciones se aplican con `prisma migrate deploy` antes de iniciar la nueva API.
5. Antes de cada despliegue se genera un backup SQL y una copia consistente del almacenamiento
   documental; la restauración se ensaya periódicamente en un entorno aislado.

No existe despliegue automático a producción porque requiere suscripción cloud, dominio, secretos y
aprobación del propietario. GitHub Actions deja el artefacto validado y reproducible.
