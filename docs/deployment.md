# Despliegue

## Desarrollo

Docker Compose inicia SQL Server 2022 y FastAPI, publicados solo en `127.0.0.1` (SQL Server en
`127.0.0.1:14330`, FastAPI en `127.0.0.1:8000`). La API y la web se ejecutan con hot reload mediante
`npm run dev`, que funciona igual en Windows, Linux y macOS. Los documentos se guardan fuera del
repositorio en `DOCUMENT_STORAGE_PATH`.

Esta configuración es para la edición local: credenciales de ejemplo, sin TLS y sin autenticación
en el servicio IA. No es una configuración segura de producción.

## Proxy inverso

`TRUST_PROXY` debe reflejar la topología real. Sin proxy, `false` (valor por defecto). Detrás de un
balanceador o App Service, indique el número de saltos de proxies propios (por ejemplo `1`) o sus
subredes; nunca `true`, que la API rechaza al arrancar porque permitiría a cualquier cliente
falsificar su IP para evadir el rate limiting o alterar la auditoría.

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
